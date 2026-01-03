"""User and authentication endpoints"""
from typing import Any, Optional, List, Literal
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from loguru import logger

from core.auth import get_current_user
from core.database import db_manager, get_db
from pymongo.asynchronous.database import AsyncDatabase

# Create router for this module
router = APIRouter(tags=["user"])

# Request/Response models
class DefaultPortfolioRequest(BaseModel):
    portfolio_id: str

class ChartMarker(BaseModel):
    """Chart marker for events like user join date"""
    id: str
    date: str  # ISO date string
    label: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None  # Emoji or icon identifier

class ChartMarkersResponse(BaseModel):
    """Response containing list of chart markers"""
    markers: List[ChartMarker]

class MiniChartTimeframeRequest(BaseModel):
    """Request to set mini-chart timeframe preference"""
    timeframe: Literal['7d', '30d', '1y']

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


@router.get("/chart-markers", response_model=ChartMarkersResponse)
async def get_chart_markers(
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
) -> ChartMarkersResponse:
    """
    Get chart markers for the user (e.g., join date, milestones).
    Returns a list of markers that can be displayed on the portfolio value chart.
    """
    try:
        markers: List[ChartMarker] = []
        
        # Get user profile for join date
        profile_collection = db.user_profiles
        profile = await profile_collection.find_one({"user_id": user.id})
        
        if profile and profile.get("created_at"):
            created_at = profile["created_at"]
            # Handle both datetime object and string formats
            if isinstance(created_at, datetime):
                date_str = created_at.strftime("%Y-%m-%d")
            else:
                date_str = str(created_at)[:10]  # Extract YYYY-MM-DD from ISO string
            
            markers.append(ChartMarker(
                id="user_join",
                date=date_str,
                label="Joined Vestika",
                description=f"You joined Vestika on {date_str}",
                color="#22c55e",  # Green color
                icon="🎉"
            ))
        
        # Future: Add more markers here
        # - Portfolio creation dates
        # - Significant transactions
        # - Achievement milestones
        
        return ChartMarkersResponse(markers=markers)
        
    except Exception as e:
        logger.error(f"🔍 [CHART MARKERS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mini-chart-timeframe")
async def get_mini_chart_timeframe(user=Depends(get_current_user)) -> dict[str, str]:
    """
    Get the user's preferred mini-chart timeframe for the holdings table.
    Default is '7d' if not set.
    """
    try:
        collection = db_manager.get_collection("user_preferences")
        preferences = await collection.find_one({"user_id": user.id})
        
        if not preferences:
            return {"timeframe": "7d"}  # Default
        
        return {
            "timeframe": preferences.get("mini_chart_timeframe", "7d")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mini-chart-timeframe")
async def set_mini_chart_timeframe(
    request: MiniChartTimeframeRequest,
    user=Depends(get_current_user)
) -> dict[str, str]:
    """
    Set the user's preferred mini-chart timeframe for the holdings table.
    Valid values: '7d', '30d', '1y'
    """
    try:
        preferences_collection = db_manager.get_collection("user_preferences")
        
        await preferences_collection.update_one(
            {"user_id": user.id},
            {
                "$set": {
                    "mini_chart_timeframe": request.timeframe,
                    "updated_at": datetime.now()
                }
            },
            upsert=True
        )
        
        return {
            "message": "Mini-chart timeframe preference saved successfully",
            "timeframe": request.timeframe
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))