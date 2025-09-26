"""Settings endpoints for user settings management"""
from typing import Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import get_current_user
from core.database import db_manager

# Create router for this module
router = APIRouter(prefix="/settings", tags=["settings"])

# Request/Response models
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

# Settings endpoints
@router.get("/", response_model=SettingsResponse)
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

@router.put("/", response_model=SettingsResponse)
async def update_user_settings(
    request: SettingsUpdateRequest, 
    user=Depends(get_current_user)
) -> SettingsResponse:
    """
    Update the user's settings.
    """
    try:
        print(f"🔍 [SETTINGS UPDATE] Updating settings for user: {user.id}, data: {request}")
        collection = db_manager.get_collection("user_settings")
        
        # Prepare update data (only include non-None values)
        update_data = {"updated_at": datetime.utcnow()}
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
        if request.profile_visibility is not None:
            update_data["profile_visibility"] = request.profile_visibility
        if request.data_sharing is not None:
            update_data["data_sharing"] = request.data_sharing
        if request.analytics_tracking is not None:
            update_data["analytics_tracking"] = request.analytics_tracking
        if request.sound_enabled is not None:
            update_data["sound_enabled"] = request.sound_enabled
        if request.volume is not None:
            update_data["volume"] = request.volume
        
        # Update or create settings
        result = await collection.update_one(
            {"user_id": user.id},
            {"$set": update_data},
            upsert=True
        )
        
        # If it was an upsert, also set the created_at and any missing default values
        if result.upserted_id:
            default_values = {
                "created_at": datetime.utcnow()
            }
            
            # Set any missing default values
            default_settings = {
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
            }
            
            for key, value in default_settings.items():
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
