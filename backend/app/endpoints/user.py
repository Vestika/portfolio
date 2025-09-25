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

class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    timezone: Optional[str] = None

class ProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    email: str
    timezone: str
    created_at: datetime
    updated_at: datetime

class SettingsUpdateRequest(BaseModel):
    # Notification settings
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    price_alerts: Optional[bool] = None
    news_updates: Optional[bool] = None
    earnings_alerts: Optional[bool] = None
    
    # Privacy settings
    profile_visibility: Optional[str] = None
    data_sharing: Optional[bool] = None
    analytics_tracking: Optional[bool] = None
    
    # Sound settings
    sound_enabled: Optional[bool] = None
    volume: Optional[int] = None

class SettingsResponse(BaseModel):
    user_id: str
    email_notifications: bool
    push_notifications: bool
    price_alerts: bool
    news_updates: bool
    earnings_alerts: bool
    profile_visibility: str
    data_sharing: bool
    analytics_tracking: bool
    sound_enabled: bool
    volume: int
    created_at: datetime
    updated_at: datetime

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

@router.get("/test")
async def test_endpoint(user=Depends(get_current_user)):
    """Test endpoint to verify user router is working"""
    return {
        "message": "User router is working",
        "user_id": user.id,
        "user_email": user.email
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

# Profile endpoints
@router.get("/profile", response_model=ProfileResponse)
async def get_user_profile(user=Depends(get_current_user)) -> ProfileResponse:
    """
    Get the user's profile information.
    """
    try:
        print(f"🔍 [PROFILE] Getting profile for user: {user.id}")
        collection = db_manager.get_collection("user_profiles")
        profile = await collection.find_one({"user_id": user.id})
        print(f"🔍 [PROFILE] Found profile: {profile}")
        
        if not profile:
            # Create a default profile if none exists
            default_profile = {
                "user_id": user.id,
                "display_name": user.display_name or "",
                "email": user.email,
                "timezone": "UTC",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = await collection.insert_one(default_profile)
            profile = await collection.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId to string for JSON serialization
        profile["_id"] = str(profile["_id"])
        return ProfileResponse(**profile)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/profile", response_model=ProfileResponse)
async def update_user_profile(
    request: ProfileUpdateRequest, 
    user=Depends(get_current_user)
) -> ProfileResponse:
    """
    Update the user's profile information.
    """
    try:
        print(f"🔍 [PROFILE UPDATE] Updating profile for user: {user.id}, data: {request}")
        collection = db_manager.get_collection("user_profiles")
        
        # Prepare update data (only include non-None values)
        update_data = {"updated_at": datetime.utcnow()}
        if request.display_name is not None:
            update_data["display_name"] = request.display_name
        if request.timezone is not None:
            update_data["timezone"] = request.timezone
        
        # Update or create profile
        result = await collection.update_one(
            {"user_id": user.id},
            {"$set": update_data},
            upsert=True
        )
        
        # If it was an upsert, also set the email and created_at
        if result.upserted_id:
            await collection.update_one(
                {"_id": result.upserted_id},
                {
                    "$set": {
                        "email": user.email,
                        "created_at": datetime.utcnow()
                    }
                }
            )
        
        # Return updated profile
        updated_profile = await collection.find_one({"user_id": user.id})
        updated_profile["_id"] = str(updated_profile["_id"])
        return ProfileResponse(**updated_profile)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Settings endpoints
@router.get("/settings", response_model=SettingsResponse)
async def get_user_settings(user=Depends(get_current_user)) -> SettingsResponse:
    """
    Get the user's settings.
    """
    try:
        collection = db_manager.get_collection("user_settings")
        settings = await collection.find_one({"user_id": user.id})
        
        if not settings:
            # Create default settings if none exist
            default_settings = {
                "user_id": user.id,
                "email_notifications": True,
                "push_notifications": True,
                "price_alerts": True,
                "news_updates": False,
                "earnings_alerts": True,
                "profile_visibility": "private",
                "data_sharing": False,
                "analytics_tracking": True,
                "sound_enabled": True,
                "volume": 50,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = await collection.insert_one(default_settings)
            settings = await collection.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId to string for JSON serialization
        settings["_id"] = str(settings["_id"])
        return SettingsResponse(**settings)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/settings", response_model=SettingsResponse)
async def update_user_settings(
    request: SettingsUpdateRequest, 
    user=Depends(get_current_user)
) -> SettingsResponse:
    """
    Update the user's settings.
    """
    try:
        collection = db_manager.get_collection("user_settings")
        
        # Prepare update data (only include non-None values)
        update_data = {"updated_at": datetime.utcnow()}
        
        # Notification settings
        if request.email_notifications is not None:
            update_data["email_notifications"] = request.email_notifications
        if request.push_notifications is not None:
            update_data["push_notifications"] = request.push_notifications
        if request.price_alerts is not None:
            update_data["price_alerts"] = request.price_alerts
        if request.news_updates is not None:
            update_data["news_updates"] = request.news_updates
        if request.earnings_alerts is not None:
            update_data["earnings_alerts"] = request.earnings_alerts
        
        # Privacy settings
        if request.profile_visibility is not None:
            if request.profile_visibility not in ["private", "friends", "public"]:
                raise HTTPException(status_code=400, detail="Invalid profile_visibility value")
            update_data["profile_visibility"] = request.profile_visibility
        if request.data_sharing is not None:
            update_data["data_sharing"] = request.data_sharing
        if request.analytics_tracking is not None:
            update_data["analytics_tracking"] = request.analytics_tracking
        
        # Sound settings
        if request.sound_enabled is not None:
            update_data["sound_enabled"] = request.sound_enabled
        if request.volume is not None:
            if not (0 <= request.volume <= 100):
                raise HTTPException(status_code=400, detail="Volume must be between 0 and 100")
            update_data["volume"] = request.volume
        
        # Update or create settings
        result = await collection.update_one(
            {"user_id": user.id},
            {"$set": update_data},
            upsert=True
        )
        
        # If it was an upsert, set default values for any missing fields
        if result.upserted_id:
            default_values = {
                "email_notifications": True,
                "push_notifications": True,
                "price_alerts": True,
                "news_updates": False,
                "earnings_alerts": True,
                "profile_visibility": "private",
                "data_sharing": False,
                "analytics_tracking": True,
                "sound_enabled": True,
                "volume": 50,
                "created_at": datetime.utcnow()
            }
            
            # Only set defaults for fields that weren't in the update
            for key, value in default_values.items():
                if key not in update_data:
                    default_values[key] = value
            
            await collection.update_one(
                {"_id": result.upserted_id},
                {"$set": default_values}
            )
        
        # Return updated settings
        updated_settings = await collection.find_one({"user_id": user.id})
        updated_settings["_id"] = str(updated_settings["_id"])
        return SettingsResponse(**updated_settings)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))