"""Browser extension endpoints for portfolio data import"""
import logging
import json
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
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
    ImportHoldingsRequest,
    ImportHoldingsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# EXTRACTION ENDPOINT
# ============================================================================

@router.post("/api/extension/extract")
async def extract_holdings(
    request: ExtractHoldingsRequest,
    user=Depends(get_current_user)
) -> ExtractHoldingsResponse:
    """
    Extract portfolio holdings from HTML using Google Gemini AI.

    This endpoint:
    1. Accepts HTML from a brokerage website
    2. Uses AI to parse and extract holding data
    3. Returns structured holdings with confidence scores
    """
    try:
        start_time = datetime.utcnow()

        # Validate API key
        if not settings.google_ai_api_key:
            raise HTTPException(
                status_code=503,
                detail="AI extraction service not configured"
            )

        # Initialize Gemini client
        client = genai.Client(api_key=settings.google_ai_api_key)

        # Construct AI prompt
        prompt = f"""
You are a financial data extraction assistant. Analyze the following HTML from a brokerage portfolio page and extract all investment holdings.

HTML Content:
{request.html_body}

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
            raise HTTPException(
                status_code=500,
                detail="AI returned invalid JSON format"
            )

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

        return ExtractHoldingsResponse(
            holdings=holdings,
            extraction_metadata={
                "model_used": settings.google_ai_model,
                "timestamp": datetime.utcnow().isoformat(),
                "html_size_bytes": len(request.html_body),
                "extraction_time_ms": extraction_time_ms,
                "holdings_count": len(holdings)
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in extract_holdings: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}"
        )


# ============================================================================
# IMPORT ENDPOINT
# ============================================================================

@router.post("/api/extension/import")
async def import_holdings(
    request: ImportHoldingsRequest,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
) -> ImportHoldingsResponse:
    """
    Import holdings into a portfolio account.

    Logic:
    - If account_id is provided: Update existing account
    - If account_id is None: Create new account with account_name
    - If replace_holdings = True: Replace all holdings
    - If replace_holdings = False: Merge holdings (update existing, add new)
    """
    try:
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

        if request.account_id:
            # Update existing account
            accounts = portfolio_doc.get("accounts", [])
            account_index = None

            # Find account by ID or name
            for i, acc in enumerate(accounts):
                acc_id = acc.get("_id") or acc.get("id")
                if str(acc_id) == request.account_id:
                    account_index = i
                    break
                # Fallback: match by name if provided
                if request.account_name and acc.get("name") == request.account_name:
                    account_index = i
                    break

            if account_index is None:
                raise HTTPException(
                    status_code=404,
                    detail="Account not found in portfolio"
                )

            # Update holdings
            if request.replace_holdings:
                accounts[account_index]["holdings"] = request.holdings
            else:
                # Merge holdings (update existing symbols, add new ones)
                existing_holdings = {
                    h["symbol"]: h
                    for h in accounts[account_index].get("holdings", [])
                }
                for new_holding in request.holdings:
                    existing_holdings[new_holding["symbol"]] = new_holding
                accounts[account_index]["holdings"] = list(existing_holdings.values())

            # Update portfolio document
            await collection.update_one(
                {"_id": ObjectId(request.portfolio_id)},
                {"$set": {"accounts": accounts}}
            )

            return ImportHoldingsResponse(
                success=True,
                portfolio_id=request.portfolio_id,
                account_id=request.account_id,
                account_name=accounts[account_index]["name"],
                imported_holdings_count=len(request.holdings),
                message="Account updated successfully"
            )

        else:
            # Create new account
            if not request.account_name:
                raise HTTPException(
                    status_code=400,
                    detail="account_name is required when creating a new account"
                )

            # Check for duplicate account name
            existing_accounts = portfolio_doc.get("accounts", [])
            if any(acc.get("name") == request.account_name for acc in existing_accounts):
                raise HTTPException(
                    status_code=409,
                    detail=f"Account '{request.account_name}' already exists"
                )

            # Create new account
            new_account_id = str(ObjectId())
            new_account = {
                "_id": new_account_id,
                "name": request.account_name,
                "type": request.account_type,
                "owners": ["me"],
                "holdings": request.holdings,
                "rsu_plans": [],
                "espp_plans": [],
                "options_plans": []
            }

            # Add account to portfolio
            await collection.update_one(
                {"_id": ObjectId(request.portfolio_id)},
                {"$push": {"accounts": new_account}}
            )

            return ImportHoldingsResponse(
                success=True,
                portfolio_id=request.portfolio_id,
                account_id=new_account_id,
                account_name=request.account_name,
                imported_holdings_count=len(request.holdings),
                message="Account created successfully"
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

@router.post("/api/extension/configs")
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


@router.get("/api/extension/configs")
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


@router.get("/api/extension/configs/{config_id}")
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


@router.put("/api/extension/configs/{config_id}")
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


@router.delete("/api/extension/configs/{config_id}")
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

@router.post("/api/extension/private-configs")
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


@router.get("/api/extension/private-configs")
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


@router.get("/api/extension/private-configs/{config_id}")
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


@router.put("/api/extension/private-configs/{config_id}")
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


@router.delete("/api/extension/private-configs/{config_id}")
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
