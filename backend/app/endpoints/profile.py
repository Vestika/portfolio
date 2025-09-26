"""Profile endpoints for user profile management"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from pydantic import BaseModel, EmailStr
import os
from pathlib import Path
import aiofiles

from core.auth import get_current_user
from core.database import db_manager

# Create router for this module
router = APIRouter(prefix="/profile", tags=["profile"])

# Request/Response models
class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    timezone: Optional[str] = None
    profile_image_url: Optional[str] = None

class ProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    email: str
    timezone: str
    profile_image_url: Optional[str]
    created_at: datetime
    updated_at: datetime

# Profile endpoints
@router.get("/", response_model=ProfileResponse)
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

@router.put("/", response_model=ProfileResponse)
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
        if request.profile_image_url is not None:
            update_data["profile_image_url"] = request.profile_image_url
        
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

# Profile image upload endpoint
@router.post("/image")
async def upload_profile_image(
    file: UploadFile = File(...), 
    user=Depends(get_current_user)
) -> dict[str, str]:
    """
    Upload a profile image for the user.
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Validate file size (5MB limit)
        file_size = 0
        content = await file.read()
        file_size = len(content)
        if file_size > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads/profile_images")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename using user ID (will overwrite existing image)
        file_extension = Path(file.filename).suffix if file.filename else '.jpg'
        # Use user ID as filename to ensure one image per user
        filename = f"{user.id}{file_extension}"
        file_path = upload_dir / filename
        
        # Check if user already has an image and delete it
        for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            old_file_path = upload_dir / f"{user.id}{ext}"
            if old_file_path.exists() and old_file_path != file_path:
                old_file_path.unlink()
                print(f"🗑️ [PROFILE IMAGE] Deleted old image: {old_file_path}")
                break
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        print(f"💾 [PROFILE IMAGE] Saved image for user {user.id}: {file_path}")
        
        # Generate URL (for now, using relative path - in production, use full URL)
        image_url = f"/uploads/profile_images/{filename}"
        
        # Update user profile with image URL
        collection = db_manager.get_collection("user_profiles")
        await collection.update_one(
            {"user_id": user.id},
            {
                "$set": {
                    "profile_image_url": image_url,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        return {"image_url": image_url, "message": "Profile image uploaded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@router.delete("/image")
async def delete_profile_image(user=Depends(get_current_user)) -> dict[str, str]:
    """
    Delete the user's profile image.
    """
    try:
        collection = db_manager.get_collection("user_profiles")
        profile = await collection.find_one({"user_id": user.id})
        
        if not profile or not profile.get("profile_image_url"):
            raise HTTPException(status_code=404, detail="No profile image found")
        
        # Delete file from filesystem using user ID
        # Since we know the filename format, we can construct it directly
        # Try common image extensions
        upload_dir = Path("uploads/profile_images")
        for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            file_path = upload_dir / f"{user.id}{ext}"
            if file_path.exists():
                file_path.unlink()
                break
        
        # Remove image URL from profile
        await collection.update_one(
            {"user_id": user.id},
            {
                "$unset": {"profile_image_url": ""},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return {"message": "Profile image deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")
