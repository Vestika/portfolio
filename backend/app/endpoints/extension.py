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
    ExtensionConfig,
    PrivateExtensionConfig,
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

@router.post("/api/import/configs")
async def create_shared_config(
    config: ExtensionConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Create a new shared extension configuration"""
    config.created_by = user.id
    config.created_at = datetime.utcnow()
    config.updated_at = datetime.utcnow()

    config_dict = config.dict(exclude={"id"})
    result = await db.extension_configs.insert_one(config_dict)

    return {
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
    async for doc in db.extension_configs.find({"is_public": True}):
        doc["id"] = str(doc.pop("_id"))
        configs.append(doc)
    return {"configs": configs}


@router.get("/api/import/configs/{config_id}")
async def get_shared_config(
    config_id: str,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Get a specific shared configuration"""
    doc = await db.extension_configs.find_one({"_id": ObjectId(config_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Configuration not found")

    doc["id"] = str(doc.pop("_id"))
    return doc


@router.put("/api/import/configs/{config_id}")
async def update_shared_config(
    config_id: str,
    config: ExtensionConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Update a shared configuration (only creator can update)"""
    existing = await db.extension_configs.find_one({"_id": ObjectId(config_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")

    if existing["created_by"] != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the creator can update this configuration"
        )

    config.updated_at = datetime.utcnow()
    config_dict = config.dict(exclude={"id", "created_by", "created_at"})

    await db.extension_configs.update_one(
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
    existing = await db.extension_configs.find_one({"_id": ObjectId(config_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")

    if existing["created_by"] != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the creator can delete this configuration"
        )

    await db.extension_configs.delete_one({"_id": ObjectId(config_id)})
    return {"message": "Configuration deleted successfully"}


# ============================================================================
# PRIVATE CONFIGURATION ENDPOINTS
# ============================================================================

@router.post("/api/import/private-configs")
async def create_private_config(
    config: PrivateExtensionConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Create a new private configuration (links shared config to user's portfolio)"""
    config.user_id = user.id
    config.created_at = datetime.utcnow()
    config.updated_at = datetime.utcnow()

    config_dict = config.dict(exclude={"id"})
    result = await db.private_extension_configs.insert_one(config_dict)

    return {
        "id": str(result.inserted_id),
        "message": "Private configuration created successfully"
    }


@router.get("/api/import/private-configs")
async def list_private_configs(
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """List all private configurations for current user"""
    configs = []
    async for doc in db.private_extension_configs.find({"user_id": user.id}):
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
    doc = await db.private_extension_configs.find_one({
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
    config: PrivateExtensionConfig,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
):
    """Update a private configuration"""
    existing = await db.private_extension_configs.find_one({
        "_id": ObjectId(config_id),
        "user_id": user.id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")

    config.updated_at = datetime.utcnow()
    config_dict = config.dict(exclude={"id", "user_id", "created_at"})

    await db.private_extension_configs.update_one(
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
    result = await db.private_extension_configs.delete_one({
        "_id": ObjectId(config_id),
        "user_id": user.id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return {"message": "Private configuration deleted successfully"}
