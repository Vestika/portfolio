"""Browser extension endpoints for portfolio data import"""
import logging
import json
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from google import genai
from google.genai import types

from core.auth import get_current_user
from core.database import db_manager, get_db
from config import settings
from models.extension_models import (
    SharedConfig,
    ExtensionConfig,  # Alias for backwards compatibility
    PrivateConfig,
    PrivateExtensionConfig,  # Alias for backwards compatibility
    ExtractHoldingsRequest,
    ExtractHoldingsResponse,
    ExtractedHolding,
    ExtractionSession,
    ImportHoldingsRequest,
    ImportHoldingsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# BACKGROUND EXTRACTION TASK
# ============================================================================

async def process_extraction_task(session_id: str, html_body: str, source_url: Optional[str], selector: Optional[str]):
    """
    Background task to extract holdings from HTML using AI.
    Updates the extraction session with results or error.
    """
    try:
        start_time = datetime.utcnow()

        # Get database connection
        db = await db_manager.get_database("vestika")

        # Validate API key
        if not settings.google_ai_api_key:
            await db.extraction_sessions.update_one(
                {"_id": session_id},
                {"$set": {
                    "status": "failed",
                    "error_message": "AI extraction service not configured"
                }}
            )
            return

        # Initialize Gemini client
        client = genai.Client(api_key=settings.google_ai_api_key)

        # Construct AI prompt
        prompt = f"""
You are a financial data extraction assistant. Analyze the following HTML from a brokerage portfolio page and extract all investment holdings.

HTML Content:
{html_body}

Extract the following information for each holding:
- symbol: Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)
- units: Number of shares/units held (numeric, can be fractional like 150.5)
- cost_basis: Total cost basis in dollars (optional, may not be present)
- security_name: Full name of the security (e.g., "Apple Inc.")
- confidence_score: Your confidence in the extraction accuracy (0.0 - 1.0)

Return ONLY a JSON array of holdings matching this exact structure:
[
  {{
    "symbol": "AAPL",
    "units": 150,
    "cost_basis": 12000.50,
    "security_name": "Apple Inc.",
    "confidence_score": 0.95
  }}
]

Important rules:
- Only extract securities (stocks, ETFs, bonds, mutual funds), NOT cash balances
- symbol and units are REQUIRED for each holding
- cost_basis, security_name are OPTIONAL (omit if not clearly present)
- If a field is unclear or ambiguous, reduce confidence_score
- Handle common variations:
  * "Shares", "Qty", "Quantity", "Units" all mean units
  * "Market Value", "Current Value" are NOT cost_basis (they are current value)
  * "Cost Basis", "Purchase Price", "Total Cost" are cost_basis
- Confidence score guidelines:
  * 0.9-1.0: All data clearly labeled and unambiguous
  * 0.7-0.9: Most data clear, minor ambiguities
  * 0.5-0.7: Some fields unclear or inferred
  * 0.0-0.5: High uncertainty, significant guesswork
- Return empty array [] if no holdings found
"""

        # Call Gemini API
        content = types.Content(parts=[types.Part(text=prompt)])
        response = await client.aio.models.generate_content(
            model=settings.google_ai_model,
            contents=content
        )

        # Parse JSON response
        response_text = response.text

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'```json\s*(\[.*?\])\s*```', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try to find JSON array directly
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            json_str = json_match.group(0) if json_match else "[]"

        # Parse and validate holdings
        try:
            holdings_data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            logger.error(f"Response text: {response_text}")
            await db.extraction_sessions.update_one(
                {"_id": session_id},
                {"$set": {
                    "status": "failed",
                    "error_message": "AI returned invalid JSON format"
                }}
            )
            return

        # Convert to ExtractedHolding models
        holdings = []
        for h in holdings_data:
            try:
                holding = ExtractedHolding(**h)
                holdings.append(holding)
            except Exception as e:
                logger.warning(f"Skipping invalid holding: {h}, error: {e}")

        # Calculate extraction time
        end_time = datetime.utcnow()
        extraction_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Update session with results
        await db.extraction_sessions.update_one(
            {"_id": session_id},
            {"$set": {
                "status": "completed",
                "extracted_holdings": [h.dict() for h in holdings],
                "extraction_metadata": {
                    "model_used": settings.google_ai_model,
                    "timestamp": datetime.utcnow().isoformat(),
                    "html_size_bytes": len(html_body),
                    "extraction_time_ms": extraction_time_ms,
                    "holdings_count": len(holdings)
                },
                "html_body": None  # Clear HTML to save space
            }}
        )

        logger.info(f"Completed extraction for session {session_id}: {len(holdings)} holdings")

    except Exception as e:
        logger.error(f"Error in background extraction task: {e}", exc_info=True)
        try:
            db = await db_manager.get_database("vestika")
            await db.extraction_sessions.update_one(
                {"_id": session_id},
                {"$set": {
                    "status": "failed",
                    "error_message": str(e)
                }}
            )
        except Exception as update_error:
            logger.error(f"Failed to update session status: {update_error}")


# ============================================================================
# EXTRACTION ENDPOINT
# ============================================================================

@router.post("/api/import/extract")
async def extract_holdings(
    request: ExtractHoldingsRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
) -> ExtractHoldingsResponse:
    """
    Extract portfolio holdings from HTML using Google Gemini AI (background task).

    Flow:
    1. Create extraction session with "processing" status
    2. Return session_id immediately
    3. Process extraction in background
    4. Frontend polls session status until "completed" or "failed"
    """
    try:
        # Create extraction session with "processing" status
        session = ExtractionSession(
            user_id=user.id,
            status="processing",
            extracted_holdings=[],
            extraction_metadata={},
            source_url=request.source_url,
            selector=request.selector,
            html_body=request.html_body  # Store HTML temporarily for background task
        )

        # Save to database (temporary collection with TTL)
        session_dict = session.dict()
        session_dict["_id"] = session.session_id  # Use session_id as _id
        await db.extraction_sessions.insert_one(session_dict)

        # Start background task
        background_tasks.add_task(
            process_extraction_task,
            session.session_id,
            request.html_body,
            request.source_url,
            request.selector
        )

        logger.info(f"Created extraction session {session.session_id} for user {user.id} (processing in background)")

        return ExtractHoldingsResponse(
            session_id=session.session_id
        )

    except Exception as e:
        logger.error(f"Error in extract_holdings: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start extraction: {str(e)}"
        )


# ============================================================================
# FILE UPLOAD ENDPOINT
# ============================================================================

@router.post("/api/import/upload")
async def upload_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
) -> ExtractHoldingsResponse:
    """
    Upload a file (PDF, CSV, image) and extract holdings using AI.

    Supported file types:
    - PDF: Brokerage statements
    - CSV: Holdings export
    - JPG/PNG: Screenshots of portfolio pages

    Returns session_id for tracking extraction progress.
    """
    try:
        # Validate file type
        allowed_types = {
            "application/pdf",
            "text/csv",
            "image/jpeg",
            "image/jpg",
            "image/png"
        }

        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, CSV, JPG, PNG"
            )

        # Read file content
        file_bytes = await file.read()

        # For now, convert to text representation
        # TODO: Implement proper file parsing (PyPDF2 for PDF, etc.)
        if file.content_type == "text/csv":
            file_content = file_bytes.decode('utf-8')
        elif file.content_type == "application/pdf":
            # For PDF, we'll send the raw content as base64 for now
            # Google Gemini can handle PDFs
            import base64
            file_content = f"PDF_BASE64:{base64.b64encode(file_bytes).decode('utf-8')}"
        else:
            # For images, convert to base64
            import base64
            file_content = f"IMAGE_BASE64:{base64.b64encode(file_bytes).decode('utf-8')}"

        # Create extraction session
        session = ExtractionSession(
            user_id=user.id,
            status="processing",
            extracted_holdings=[],
            extraction_metadata={},
            source_url=f"uploaded_file:{file.filename}",
            selector=None,
            html_body=file_content  # Store file content temporarily
        )

        # Save to database
        session_dict = session.dict()
        session_dict["_id"] = session.session_id
        await db.extraction_sessions.insert_one(session_dict)

        # Start background task with file content
        background_tasks.add_task(
            process_extraction_task,
            session.session_id,
            file_content,
            f"uploaded_file:{file.filename}",
            None
        )

        logger.info(f"Created file upload extraction session {session.session_id} for user {user.id} (file: {file.filename})")

        return ExtractHoldingsResponse(
            session_id=session.session_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload_file: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process uploaded file: {str(e)}"
        )


# ============================================================================
# SESSION ENDPOINT
# ============================================================================

@router.get("/api/import/sessions/{session_id}")
async def get_extraction_session(
    session_id: str,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """
    Retrieve an extraction session for review/editing.

    Used by web app /import page to display extracted holdings.
    """
    try:
        session_doc = await db.extraction_sessions.find_one({"_id": session_id})

        if not session_doc:
            raise HTTPException(
                status_code=404,
                detail="Session not found or expired"
            )

        # Verify ownership
        if session_doc.get("user_id") != user.id:
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )

        # Convert _id back to session_id for response
        session_doc["session_id"] = session_doc.pop("_id")

        return session_doc

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving session {session_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve session"
        )


# ============================================================================
# IMPORT ENDPOINT
# ============================================================================

@router.post("/api/import/holdings")
async def import_holdings(
    request: ImportHoldingsRequest,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
) -> ImportHoldingsResponse:
    """
    Import holdings into a portfolio account.

    Flow:
    1. Load holdings from extraction session
    2. Import to portfolio/account
    3. Delete session

    Logic:
    - If account_name matches existing account: OVERRIDE (replace) all holdings in that account
    - If account_name is new: CREATE new account with the provided name and type
    - NOTE: We always OVERRIDE holdings, never merge/append
    """
    try:
        # Load extraction session
        session_doc = await db.extraction_sessions.find_one({"_id": request.session_id})

        if not session_doc:
            raise HTTPException(
                status_code=404,
                detail="Session not found or expired"
            )

        # Verify ownership
        if session_doc.get("user_id") != user.id:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this session"
            )

        # Extract holdings from session
        session_holdings = session_doc.get("extracted_holdings", [])
        holdings = [{"symbol": h["symbol"], "units": h["units"]} for h in session_holdings]

        collection = db.portfolios

        # Verify portfolio ownership
        portfolio_doc = await collection.find_one({
            "_id": ObjectId(request.portfolio_id),
            "user_id": user.id
        })

        if not portfolio_doc:
            raise HTTPException(
                status_code=404,
                detail="Portfolio not found or access denied"
            )

        accounts = portfolio_doc.get("accounts", [])

        # If no account_name provided, generate a default one
        if not request.account_name:
            request.account_name = f"Imported Account {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

        # Find account by name (MongoDB stores it as "name" field per Account model)
        account_index = None
        for i, acc in enumerate(accounts):
            if acc.get("name") == request.account_name:
                account_index = i
                break

        if account_index is not None:
            # Existing account found - OVERRIDE holdings
            logger.info(f"Overriding holdings in existing account '{request.account_name}' (index {account_index})")

            # Override all holdings in this account
            accounts[account_index]["holdings"] = holdings

            # Update portfolio document
            await collection.update_one(
                {"_id": ObjectId(request.portfolio_id)},
                {"$set": {"accounts": accounts}}
            )

            # Delete extraction session after successful import
            await db.extraction_sessions.delete_one({"_id": request.session_id})

            account_id = accounts[account_index].get("_id") or accounts[account_index].get("id") or str(ObjectId())

            return ImportHoldingsResponse(
                success=True,
                portfolio_id=request.portfolio_id,
                account_id=str(account_id),
                account_name=request.account_name,
                imported_holdings_count=len(holdings),
                message=f"Successfully overridden holdings in account '{request.account_name}'"
            )

        else:
            # Account not found - CREATE new account
            logger.info(f"Creating new account '{request.account_name}'")

            new_account_id = str(ObjectId())
            new_account = {
                "_id": new_account_id,
                "name": request.account_name,  # MongoDB stores account name in "name" field per Account model
                "properties": {
                    "owners": ["me"],
                    "type": request.account_type
                },
                "holdings": holdings,
                "rsu_plans": [],
                "espp_plans": [],
                "options_plans": []
            }

            # Add account to portfolio
            await collection.update_one(
                {"_id": ObjectId(request.portfolio_id)},
                {"$push": {"accounts": new_account}}
            )

            # Delete extraction session after successful import
            await db.extraction_sessions.delete_one({"_id": request.session_id})

            return ImportHoldingsResponse(
                success=True,
                portfolio_id=request.portfolio_id,
                account_id=new_account_id,
                account_name=request.account_name,
                imported_holdings_count=len(holdings),
                message=f"Successfully created account '{request.account_name}' with {len(holdings)} holdings"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in import_holdings: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )


# ============================================================================
# CONFIGURATION ENDPOINTS
# ============================================================================

@router.get("/api/import/configs/match")
async def match_shared_configs(
    url: str,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """
    Match URL to available shared configs.

    Returns configs sorted by success_rate DESC, usage_count DESC.
    Returns top 3 matches.
    """
    try:
        # Active configs visible to the user (public or owned)
        matching_configs = []

        query = {
            "status": "active",
            "$or": [
                {"is_public": True},
                {"creator_id": user.id}
            ]
        }

        async for doc in db.shared_configs.find(query):
            # Test URL against pattern
            try:
                pattern = doc.get("url_pattern", "")
                if re.search(pattern, url):
                    # Convert _id to config_id for response
                    config_dict = {
                        "config_id": doc.get("config_id") or str(doc["_id"]),
                        "site_name": doc.get("site_name", ""),
                        "url_pattern": doc.get("url_pattern", ""),
                        "selector": doc.get("selector"),
                        "full_page": doc.get("full_page", True),
                        "creator_name": doc.get("creator_name"),
                        "verified": doc.get("verified", False),
                        "status": doc.get("status", "active"),
                        "usage_count": doc.get("usage_count", 0),
                        "success_rate": doc.get("success_rate", 0.0),
                        "last_used_at": doc.get("last_used_at"),
                        "visibility": "public" if doc.get("is_public") else "private",
                        "is_owner": doc.get("creator_id") == user.id
                    }
                    matching_configs.append(config_dict)
            except re.error as e:
                logger.warning(f"Invalid regex pattern in config {doc.get('_id')}: {e}")
                continue

        # Sort by success_rate DESC, then usage_count DESC
        matching_configs.sort(
            key=lambda x: (x["success_rate"], x["usage_count"]),
            reverse=True
        )

        # Return top 3
        top_matches = matching_configs[:3]

        return {
            "configs": top_matches,
            "matched": len(top_matches) > 0
        }

    except Exception as e:
        logger.error(f"Error in match_shared_configs: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to match configs"
        )


@router.post("/api/import/configs")
async def create_shared_config(
    config: SharedConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Create a new shared extension configuration"""
    # Generate config_id if not provided
    if not config.config_id:
        # Generate from site_name (e.g., "Robinhood" → "cfg_robinhood_v1")
        site_slug = config.site_name.lower().replace(" ", "_")
        config.config_id = f"cfg_{site_slug}_v1"

    config.creator_id = user.id
    config.created_at = datetime.utcnow()
    config.updated_at = datetime.utcnow()

    config_dict = config.dict(exclude_unset=True)
    result = await db.shared_configs.insert_one(config_dict)

    return {
        "config_id": config.config_id,
        "id": str(result.inserted_id),
        "message": "Configuration created successfully"
    }


@router.get("/api/import/configs")
async def list_shared_configs(
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """List all public shared configurations"""
    configs = []
    query = {
        "$or": [
            {"is_public": True},
            {"creator_id": user.id}
        ]
    }
    async for doc in db.shared_configs.find(query):
        doc["id"] = str(doc.pop("_id"))
        doc["visibility"] = "public" if doc.get("is_public") else "private"
        doc["is_owner"] = doc.get("creator_id") == user.id
        configs.append(doc)
    return {"configs": configs}


@router.get("/api/import/configs/enabled")
async def get_enabled_configs(
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """
    Get all enabled configs for the current user.
    Returns both manual and auto-sync configs.
    """
    enabled_configs = []

    async for private_config in db.private_configs.find({
        "user_id": user.id,
        "enabled": True
    }):
        config_id = private_config.get("shared_config_id")
        portfolio_id = private_config.get("portfolio_id")

        # Determine mode based on whether portfolio is set
        mode = "auto" if portfolio_id else "manual"

        # Get portfolio name if auto mode
        portfolio_name = None
        if mode == "auto" and portfolio_id:
            portfolio = await db.portfolios.find_one({"id": portfolio_id})
            if portfolio:
                portfolio_name = portfolio.get("portfolio_name")

        enabled_configs.append({
            "config_id": config_id,
            "mode": mode,
            "portfolio_name": portfolio_name,
            "account_name": private_config.get("account_name")
        })

    return {
        "enabled_configs": enabled_configs
    }


@router.get("/api/import/configs/{config_id}")
async def get_shared_config(
    config_id: str,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Get a specific shared configuration"""
    doc = await db.shared_configs.find_one({"_id": ObjectId(config_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Configuration not found")

    doc["id"] = str(doc.pop("_id"))
    return doc


@router.put("/api/import/configs/{config_id}")
async def update_shared_config(
    config_id: str,
    config: SharedConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Update a shared configuration (only creator can update)"""
    existing = await db.shared_configs.find_one({"_id": ObjectId(config_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")

    if existing.get("creator_id") != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the creator can update this configuration"
        )

    config.updated_at = datetime.utcnow()
    config_dict = config.dict(exclude={"config_id", "creator_id", "created_at"}, exclude_unset=True)

    await db.shared_configs.update_one(
        {"_id": ObjectId(config_id)},
        {"$set": config_dict}
    )

    return {"message": "Configuration updated successfully"}


@router.delete("/api/import/configs/{config_id}")
async def delete_shared_config(
    config_id: str,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Delete a shared configuration (only creator can delete)"""
    existing = await db.shared_configs.find_one({"_id": ObjectId(config_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")

    if existing.get("creator_id") != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the creator can delete this configuration"
        )

    await db.shared_configs.delete_one({"_id": ObjectId(config_id)})
    return {"message": "Configuration deleted successfully"}


# ============================================================================
# PRIVATE CONFIGURATION ENDPOINTS
# ============================================================================

@router.post("/api/import/private-configs")
async def create_private_config(
    config: PrivateConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Create a new private configuration (links shared config to user's portfolio)"""
    # Generate private_config_id if not provided
    if not config.private_config_id:
        config.private_config_id = f"pcfg_{user.id}_{config.shared_config_id}"

    config.user_id = user.id
    config.created_at = datetime.utcnow()
    config.updated_at = datetime.utcnow()

    # Upsert: one config per (user_id, shared_config_id) pair
    config_dict = config.dict(exclude_unset=True)

    await db.private_configs.update_one(
        {"user_id": user.id, "shared_config_id": config.shared_config_id},
        {"$set": config_dict},
        upsert=True
    )

    return {
        "private_config_id": config.private_config_id,
        "message": "Private configuration created successfully"
    }


@router.get("/api/import/private-configs")
async def list_private_configs(
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """List all private configurations for current user"""
    configs = []
    async for doc in db.private_configs.find({"user_id": user.id}):
        doc["id"] = str(doc.pop("_id"))
        configs.append(doc)
    return {"configs": configs}


@router.get("/api/import/private-configs/{config_id}")
async def get_private_config(
    config_id: str,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Get a specific private configuration"""
    doc = await db.private_configs.find_one({
        "_id": ObjectId(config_id),
        "user_id": user.id
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Configuration not found")

    doc["id"] = str(doc.pop("_id"))
    return doc


@router.put("/api/import/private-configs/{config_id}")
async def update_private_config(
    config_id: str,
    config: PrivateConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Update a private configuration"""
    existing = await db.private_configs.find_one({
        "_id": ObjectId(config_id),
        "user_id": user.id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")

    config.updated_at = datetime.utcnow()
    config_dict = config.dict(exclude={"private_config_id", "user_id", "created_at"}, exclude_unset=True)

    await db.private_configs.update_one(
        {"_id": ObjectId(config_id)},
        {"$set": config_dict}
    )

    return {"message": "Private configuration updated successfully"}


@router.delete("/api/import/private-configs/{config_id}")
async def delete_private_config(
    config_id: str,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Delete a private configuration"""
    result = await db.private_configs.delete_one({
        "_id": ObjectId(config_id),
        "user_id": user.id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return {"message": "Private configuration deleted successfully"}


@router.post("/api/import/configs/enable")
async def enable_config(
    data: dict,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """
    Enable a shared config for manual use or auto-sync, depending on payload.

    Request body (manual):
    {
        "config_id": "string",
        "mode": "manual"
    }

    Request body (auto):
    {
        "mode": "auto",
        "config_id": "string",             # Optional if session_id provided
        "session_id": "string",            # Optional - used to infer config
        "portfolio_id": "string",          # Required (or portfolio_name)
        "portfolio_name": "string",        # Optional name lookup
        "account_name": "string",          # Required
        "account_type": "string",          # Optional
        "notification_preference": "notification_only" | "auto_redirect"
    }
    """
    mode = data.get("mode")
    session_id = data.get("session_id")
    config_id = data.get("config_id")
    portfolio_id = data.get("portfolio_id")
    portfolio_name = data.get("portfolio_name")
    account_name = data.get("account_name")
    account_type = data.get("account_type")
    notification_preference = data.get("notification_preference", "notification_only")

    if not mode:
        mode = "auto" if session_id or portfolio_id or portfolio_name or account_name else "manual"

    if mode not in {"manual", "auto"}:
        raise HTTPException(status_code=400, detail="mode must be 'manual' or 'auto'")

    if mode == "manual":
        if not config_id:
            raise HTTPException(status_code=400, detail="config_id is required")

        shared_config = await db.shared_configs.find_one({"config_id": config_id})
        if not shared_config:
            raise HTTPException(status_code=404, detail="Shared config not found")

        private_config_id = f"pcfg_{user.id}_{config_id}"
        private_config = {
            "private_config_id": private_config_id,
            "user_id": user.id,
            "shared_config_id": config_id,
            "portfolio_id": None,
            "account_name": None,
            "account_type": None,
            "enabled": True,
            "notification_preference": "notification_only",
            "last_sync_at": None,
            "last_sync_status": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        await db.private_configs.update_one(
            {"user_id": user.id, "shared_config_id": config_id},
            {"$set": private_config},
            upsert=True
        )

        return {
            "success": True,
            "private_config_id": private_config_id,
            "site_name": shared_config.get("site_name"),
            "mode": "manual",
            "message": f"Config enabled for {shared_config.get('site_name')}"
        }

    # Auto-sync mode
    if not account_name:
        raise HTTPException(status_code=400, detail="account_name is required for auto mode")

    if not portfolio_id and portfolio_name:
        portfolio = await db.portfolios.find_one({
            "user_id": user.id,
            "portfolio_name": portfolio_name
        })
        if portfolio:
            portfolio_id = portfolio.get("id")
        else:
            raise HTTPException(status_code=404, detail=f"Portfolio '{portfolio_name}' not found")

    if not portfolio_id:
        raise HTTPException(status_code=400, detail="portfolio_id or portfolio_name is required for auto mode")

    session = None
    if session_id:
        session = await db.extraction_sessions.find_one({"session_id": session_id, "user_id": user.id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

    if not config_id and session and session.get("source_url"):
        url = session["source_url"]
        matching_config = None

        async for doc in db.shared_configs.find({"status": "active", "is_public": True}):
            try:
                pattern = doc.get("url_pattern", "")
                if re.search(pattern, url):
                    matching_config = doc
                    break
            except re.error:
                continue

        if matching_config:
            config_id = matching_config.get("config_id") or str(matching_config["_id"])
        else:
            raise HTTPException(
                status_code=404,
                detail="No config found for this session. Please provide config_id."
            )

    if not config_id:
        raise HTTPException(status_code=400, detail="config_id is required for auto mode")

    shared_config = await db.shared_configs.find_one({"config_id": config_id})
    if not shared_config:
        raise HTTPException(status_code=404, detail="Shared config not found")

    private_config_id = f"pcfg_{user.id}_{config_id}"
    private_config = {
        "private_config_id": private_config_id,
        "user_id": user.id,
        "shared_config_id": config_id,
        "portfolio_id": portfolio_id,
        "account_name": account_name,
        "account_type": account_type,
        "enabled": True,
        "notification_preference": notification_preference,
        "last_sync_at": None,
        "last_sync_status": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.private_configs.update_one(
        {"user_id": user.id, "shared_config_id": config_id},
        {"$set": private_config},
        upsert=True
    )

    return {
        "success": True,
        "private_config_id": private_config_id,
        "site_name": shared_config.get("site_name"),
        "mode": "auto",
        "message": f"Auto-sync enabled for {shared_config.get('site_name')}"
    }


@router.post("/api/import/configs/disable")
async def disable_config(
    data: dict,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """
    Disable a config (either manual or auto-sync).
    Sets enabled=False on the private config.

    Request body:
    {
        "config_id": "string"  # Required - shared config ID to disable
    }
    """
    config_id = data.get("config_id")

    if not config_id:
        raise HTTPException(status_code=400, detail="config_id is required")

    # Update private config to set enabled=False
    result = await db.private_configs.update_one(
        {"user_id": user.id, "shared_config_id": config_id},
        {"$set": {"enabled": False, "updated_at": datetime.utcnow()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Config not enabled for this user")

    return {
        "success": True,
        "message": "Config disabled successfully"
    }
