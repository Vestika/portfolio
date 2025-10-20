"""Profile endpoints for user profile management"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from core.auth import get_current_user
from core.database import db_manager

# Create router for this module
router = APIRouter(prefix="/profile", tags=["profile"])

# Note: Image cleanup functions have been removed as profile pictures are now synced from Google.

# Request/Response models
class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    timezone: Optional[str] = None

class ProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    email: str
    timezone: str
    profile_image_url: Optional[str]
    created_at: datetime
    updated_at: datetime

# Profile endpoints
@router.get("", response_model=ProfileResponse)
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
                "display_name": user.name or "",
                "email": user.email,
                "timezone": "UTC",
                "created_at": user.created_at,
                "updated_at": user.updated_at
            }
            result = await collection.insert_one(default_profile)
            profile = await collection.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId to string for JSON serialization
        profile["_id"] = str(profile["_id"])
        return ProfileResponse(**profile)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("", response_model=ProfileResponse)
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

# Note: Profile image upload endpoints have been removed.
# Profile pictures are now automatically synced from Google accounts.
