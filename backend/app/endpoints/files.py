"""File operations endpoints (upload/download)"""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import Response
import yaml

from core.auth import get_current_user
from core.database import db_manager

# Create router for this module
router = APIRouter()

@router.get("/portfolio/raw")
async def download_portfolio_raw(portfolio_id: str, user=Depends(get_current_user)):
    """
    Download the raw portfolio document as YAML.
    """
    collection = db_manager.get_collection("portfolios")
    doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    doc["_id"] = str(doc["_id"])
    yaml_str = yaml.dump(doc, allow_unicode=True)
    return Response(content=yaml_str, media_type="application/x-yaml")

@router.post("/portfolio/upload")
async def upload_portfolio(file: UploadFile = File(...), user=Depends(get_current_user)):
    """
    Upload a new portfolio as a YAML file.
    """
    try:
        content = await file.read()
        data = content.decode()
        try:
            portfolio_yaml = yaml.safe_load(data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")
        collection = db_manager.get_collection("portfolios")
        # Remove _id if present
        portfolio_yaml.pop("_id", None)
        portfolio_yaml.pop("user_id", None)
        portfolio_yaml["user_id"] = user.id
        result = await collection.insert_one(portfolio_yaml)
        return {"portfolio_id": str(result.inserted_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))