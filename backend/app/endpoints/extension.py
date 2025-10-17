from typing import Any, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError
from bson import ObjectId
from google.genai.types import GenerateContentConfig

from core.auth import get_current_user
from core.database import db_manager
from core.ai_analyst import ai_analyst
from .portfolio import CreateAccountRequest, determine_security_type_and_currency, invalidate_portfolio_cache
from core import firebase as fb
from config import settings

router = APIRouter(prefix="/extension", tags=["extension"])


class ExtractRequest(BaseModel):
    html: str
    extension_config_id: Optional[str] = None
    url: Optional[str] = None


class ImportRequest(CreateAccountRequest):
    portfolio_id: str
    account_id: Optional[str] = None  # when provided, update existing account by name
    mode: Literal["replace", "merge"] = Field(default="replace", description="Replace holdings or merge with existing")
    dry_run: bool = Field(default=False, description="If true, validate and preview without saving")


class ExtractedHolding(BaseModel):
    symbol: str
    units: float


class ExtractedAccount(BaseModel):
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    owners: Optional[list[str]] = None
    holdings: list[ExtractedHolding]
    rsu_plans: list[Any] = []
    espp_plans: list[Any] = []
    options_plans: list[Any] = []


# Simple in-process rate limiter per user per endpoint
import time
_RATE_LIMIT: dict[str, dict[str, dict[str, float | int]]] = {}
_WINDOW_SECONDS = 60
_LIMITS = {"extract": 10, "import": 20}


def _rate_limit(user_id: str, key: str):
    now = time.time()
    user_entry = _RATE_LIMIT.setdefault(user_id, {}).setdefault(key, {"window_start": now, "count": 0})
    window_start = user_entry["window_start"]  # type: ignore[index]
    count = user_entry["count"]  # type: ignore[index]
    if now - float(window_start) > _WINDOW_SECONDS:
        user_entry["window_start"] = now
        user_entry["count"] = 0
        count = 0
    limit = _LIMITS.get(key, 60)
    if int(count) >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again shortly.")
    user_entry["count"] = int(count) + 1


@router.post("/extract")
async def extract_holdings(request: ExtractRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Use Google GenAI to extract holdings-like JSON from an HTML page.
    Output must match CreateAccountRequest.holdings shape: [{ symbol, units }].
    """
    if not ai_analyst.is_available:
        raise HTTPException(status_code=503, detail="AI extraction service unavailable")
    _rate_limit(user.id, "extract")

    try:
        # Build a strict prompt for extraction
        prompt = (
            "You are given raw HTML of an investment account page. "
            "Extract a concise JSON payload for portfolio import. Return ONLY valid JSON, no prose.\n"
            "The expected schema is: {\n"
            "  \"account_name\": string,\n"
            "  \"account_type\": string (e.g., 'brokerage' or 'bank-account'),\n"
            "  \"owners\": string[] (default ['me']),\n"
            "  \"holdings\": [{ \"symbol\": string, \"units\": number }],\n"
            "  \"rsu_plans\": [], \"espp_plans\": [], \"options_plans\": []\n"
            "}.\n"
            "Symbols should be concise tickers (e.g., AAPL, MSFT, BTC-USD, FX:USD). "
            "Units must be numeric; omit any rows with missing symbols or non-numeric amounts. "
            "Use a reasonable account_name if one is visible; otherwise use 'Imported Account'.\n\n"
            f"HTML:\n{request.html[:120000]}"
        )

        # Use the same low-latency model through ai_analyst client
        content = [{"role": "user", "parts": [{"text": prompt}]}]
        response = ai_analyst.client.models.generate_content(
            model=ai_analyst.client._client_options["model"] if hasattr(ai_analyst.client, "_client_options") else "gemini-flash-lite-latest",
            contents=content,
            config=GenerateContentConfig(response_mime_type="application/json"),
        )
        text = response.candidates[0].content.parts[0].text

        # Attempt to parse JSON and validate
        import json
        payload_raw = json.loads(text)
        try:
            validated = ExtractedAccount.model_validate(payload_raw)
        except ValidationError as ve:
            raise HTTPException(status_code=422, detail=f"Invalid extraction schema: {ve}")

        result = {
            "account_name": validated.account_name or "Imported Account",
            "account_type": validated.account_type or "brokerage",
            "owners": validated.owners or ["me"],
            "holdings": [{"symbol": h.symbol, "units": h.units} for h in validated.holdings],
            "rsu_plans": validated.rsu_plans or [],
            "espp_plans": validated.espp_plans or [],
            "options_plans": validated.options_plans or [],
        }
        return {"data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_account(request: ImportRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Create or update an account within a portfolio using the provided data.
    If account_id (name) is provided, update existing; otherwise create new.
    """
    try:
        _rate_limit(user.id, "import")
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(request.portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        # Ensure securities entries for all symbols
        if "securities" not in doc:
            doc["securities"] = {}
        for holding in request.holdings:
            symbol = holding.get("symbol")
            if symbol and symbol not in doc["securities"]:
                sec_type, currency = determine_security_type_and_currency(symbol)
                doc["securities"][symbol] = {"name": symbol, "type": sec_type, "currency": currency}

        accounts = doc.get("accounts", [])

        new_account = {
            "name": request.account_name,
            "user_id": user.id,
            "properties": {
                "owners": request.owners,
                "type": request.account_type,
            },
            "holdings": request.holdings,
            "rsu_plans": request.rsu_plans,
            "espp_plans": request.espp_plans,
            "options_plans": request.options_plans,
        }

        # Update existing by account_id (interpreted as existing account name) or append as new
        updated = False
        target_index: Optional[int] = None
        if request.account_id:
            for i, acc in enumerate(accounts):
                if acc.get("name") == request.account_id:
                    target_index = i
                    updated = True
                    break

        if not updated:
            # Prevent duplicates by name
            existing_names = {acc.get("name") for acc in accounts}
            if request.account_name in existing_names and not request.account_id:
                raise HTTPException(status_code=409, detail=f"Account '{request.account_name}' already exists")
            if request.dry_run:
                return {"message": "Dry run - would create new account", "portfolio_id": request.portfolio_id, "updated": False}
            accounts.append(new_account)
        else:
            # Merge vs replace logic for existing account
            if request.mode == "merge":
                existing = accounts[target_index] if target_index is not None else {}
                existing_holdings = {h.get("symbol"): h for h in existing.get("holdings", []) if h.get("symbol")}
                for h in request.holdings:
                    sym = h.get("symbol")
                    if not sym:
                        continue
                    existing_holdings[sym] = {"symbol": sym, "units": h.get("units", 0)}
                merged_list = list(existing_holdings.values())
                merged_account = new_account | {"holdings": merged_list}
                if request.dry_run:
                    return {"message": "Dry run - would merge into existing account", "portfolio_id": request.portfolio_id, "updated": True}
                accounts[target_index] = merged_account
            else:
                # replace
                if request.dry_run:
                    return {"message": "Dry run - would replace existing account", "portfolio_id": request.portfolio_id, "updated": True}
                accounts[target_index] = new_account

        doc["accounts"] = accounts
        await collection.replace_one({"_id": ObjectId(request.portfolio_id)}, doc)

        invalidate_portfolio_cache(request.portfolio_id)
        return {"message": "Account import successful", "portfolio_id": request.portfolio_id, "updated": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Minimal shared/private configuration storage
class SharedConfig(BaseModel):
    name: str
    url: str  # pattern display
    full_url: str  # original captured URL
    selector: Optional[str] = None


class PrivateConfig(BaseModel):
    extension_config_id: str  # reference to shared config _id
    portfolio_id: str
    account_id: Optional[str] = None
    auto_sync: bool = False


@router.post("/configs/shared")
async def create_shared_config(cfg: SharedConfig, user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_shared_configs")
    doc = cfg.model_dump()
    doc.update({"user_id": user.id})
    res = await col.insert_one(doc)
    return {"extension_config_id": str(res.inserted_id)}


@router.get("/configs/shared")
async def list_shared_configs(user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_shared_configs")
    docs = await col.find({}, projection={"name": 1, "url": 1, "selector": 1, "full_url": 1}).to_list(None)
    for d in docs:
        d["extension_config_id"] = str(d.pop("_id"))
    return {"items": docs}


@router.put("/configs/shared/{extension_config_id}")
async def update_shared_config(extension_config_id: str, cfg: SharedConfig, user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_shared_configs")
    oid = ObjectId(extension_config_id)
    await col.update_one({"_id": oid}, {"$set": cfg.model_dump()})
    return {"updated": True}


@router.delete("/configs/shared/{extension_config_id}")
async def delete_shared_config(extension_config_id: str, user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_shared_configs")
    oid = ObjectId(extension_config_id)
    await col.delete_one({"_id": oid})
    return {"deleted": True}


@router.post("/configs/private")
async def create_private_config(cfg: PrivateConfig, user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_private_configs")
    doc = cfg.model_dump()
    doc.update({"user_id": user.id})
    res = await col.insert_one(doc)
    return {"private_config_id": str(res.inserted_id)}


@router.get("/configs/private")
async def list_private_configs(user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_private_configs")
    docs = await col.find({"user_id": user.id}).to_list(None)
    for d in docs:
        d["private_config_id"] = str(d.pop("_id"))
    return {"items": docs}


@router.put("/configs/private/{private_config_id}")
async def update_private_config(private_config_id: str, cfg: PrivateConfig, user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_private_configs")
    oid = ObjectId(private_config_id)
    await col.update_one({"_id": oid, "user_id": user.id}, {"$set": cfg.model_dump()})
    return {"updated": True}


@router.delete("/configs/private/{private_config_id}")
async def delete_private_config(private_config_id: str, user=Depends(get_current_user)) -> dict[str, Any]:
    col = db_manager.get_collection("extension_private_configs")
    oid = ObjectId(private_config_id)
    await col.delete_one({"_id": oid, "user_id": user.id})
    return {"deleted": True}


class GoogleIdTokenExchangeRequest(BaseModel):
    id_token: str


@router.post("/identity/custom-token")
async def exchange_google_id_token_for_custom_token(payload: GoogleIdTokenExchangeRequest) -> dict[str, Any]:
    """Verify a Google ID token and mint a Firebase custom token for that Google user."""
    try:
        fb._initialize_firebase()
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        from firebase_admin import auth as admin_auth

        if not settings.google_web_client_id:
            raise HTTPException(status_code=500, detail="Google web client ID not configured")

        # Verify Google ID token against the configured web client
        request_adapter = google_requests.Request()
        idinfo = google_id_token.verify_oauth2_token(payload.id_token, request_adapter, settings.google_web_client_id)

        # Extract a stable uid (use Google sub)
        uid = idinfo.get('sub')
        if not uid:
            raise HTTPException(status_code=400, detail="Invalid Google ID token")

        # Optionally, set Firebase user claims based on email, etc.
        # Mint Firebase custom token
        custom_token = admin_auth.create_custom_token(uid)
        token_str = custom_token.decode("utf-8") if hasattr(custom_token, 'decode') else custom_token
        return {"custom_token": token_str}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google token verification failed: {e}")

