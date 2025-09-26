"""User and authentication endpoints"""
from typing import Any, Optional
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from core.auth import get_current_user
from core.database import db_manager

# Create router for this module
router = APIRouter()

# Request/Response models
class DefaultPortfolioRequest(BaseModel):
    portfolio_id: str

@router.get("/")
async def root(user=Depends(get_current_user)):
    """Root endpoint with service information"""
    return {
        "service": "Portfolio API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
        "user": user.email
    }

@router.get("/default-portfolio")
async def get_default_portfolio(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Get the default portfolio for the authenticated user.
    """
    try:
        collection = db_manager.get_collection("user_preferences")
        preferences = await collection.find_one({"user_id": user.id})
        
        if not preferences:
            return {"default_portfolio_id": None}
        
        return {
            "default_portfolio_id": preferences.get("default_portfolio_id")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/default-portfolio")
async def set_default_portfolio(request: DefaultPortfolioRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Set the default portfolio for the authenticated user.
    """
    try:
        # Validate that the portfolio exists and belongs to the user
        portfolios_collection = db_manager.get_collection("portfolios")
        portfolio_exists = await portfolios_collection.find_one({"_id": ObjectId(request.portfolio_id), "user_id": user.id})
        if not portfolio_exists:
            raise HTTPException(status_code=404, detail=f"Portfolio {request.portfolio_id} not found")
        
        # Update or create user preferences
        preferences_collection = db_manager.get_collection("user_preferences")
        
        # Try to update existing preferences
        result = await preferences_collection.update_one(
            {"user_id": user.id},
            {
                "$set": {
                    "default_portfolio_id": request.portfolio_id,
                    "updated_at": datetime.now()
                }
            },
            upsert=True
        )
        
        return {
            "message": "Default portfolio set successfully",
            "portfolio_id": request.portfolio_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))