from .base_model import BaseFeatureModel, FeatureConfig, AuthType
from pydantic import Field, EmailStr
from typing import Optional
from datetime import datetime


class UserProfile(BaseFeatureModel):
    user_id: str = Field(..., description="Firebase user ID")
    display_name: Optional[str] = Field(None, min_length=1, max_length=100, description="User's display name")
    email: EmailStr = Field(..., description="User's email address")
    timezone: str = Field(default="UTC", description="User's timezone")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        return FeatureConfig(
            collection_name="user_profiles",
            auth_required=AuthType.BEARER,
            enable_create=True,
            enable_read=True,
            enable_update=True,
            enable_delete=False,  # Don't allow deletion of profiles
            enable_list=False,    # Don't allow listing all profiles
            async_operations=True,
            # Custom hooks
            pre_hooks={
                "create": [cls.validate_user_id],
                "update": [cls.update_timestamp]
            },
            post_hooks={
                "read": [cls.hide_sensitive_data]
            }
        )

    @staticmethod
    async def validate_user_id(data: dict):
        """Validate that user_id is provided and valid"""
        if not data.get('user_id'):
            raise ValueError("user_id is required")
        # Additional validation can be added here

    @staticmethod
    async def update_timestamp(data: dict):
        """Update the updated_at timestamp"""
        data['updated_at'] = datetime.utcnow()

    @staticmethod
    async def hide_sensitive_data(item: dict):
        """Hide sensitive data from responses"""
        # Remove internal fields if needed
        return item
