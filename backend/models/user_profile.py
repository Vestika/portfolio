from .base_model import BaseFeatureModel
from pydantic import Field, EmailStr
from typing import Optional
from datetime import datetime


class UserProfile(BaseFeatureModel):
    user_id: str = Field(..., description="Firebase user ID")
    display_name: Optional[str] = Field(None, min_length=1, max_length=100, description="User's display name")
    email: EmailStr = Field(..., description="User's email address")
    timezone: str = Field(default="UTC", description="User's timezone")
    profile_image_url: Optional[str] = Field(None, description="URL to user's profile image")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
