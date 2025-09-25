from .base_model import BaseFeatureModel, FeatureConfig, AuthType
from pydantic import Field
from typing import Optional, Literal
from datetime import datetime


class UserSettings(BaseFeatureModel):
    user_id: str = Field(..., description="Firebase user ID")
    
    # Notification settings
    email_notifications: bool = Field(default=True, description="Enable email notifications")
    push_notifications: bool = Field(default=True, description="Enable push notifications")
    price_alerts: bool = Field(default=True, description="Enable price alerts")
    news_updates: bool = Field(default=False, description="Enable news updates")
    earnings_alerts: bool = Field(default=True, description="Enable earnings alerts")
    
    # Privacy settings
    profile_visibility: Literal["private", "friends", "public"] = Field(default="private", description="Profile visibility level")
    data_sharing: bool = Field(default=False, description="Allow data sharing for product improvement")
    analytics_tracking: bool = Field(default=True, description="Enable analytics tracking")
    
    # Sound settings
    sound_enabled: bool = Field(default=True, description="Enable sound notifications")
    volume: int = Field(default=50, ge=0, le=100, description="Notification volume level")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        return FeatureConfig(
            collection_name="user_settings",
            auth_required=AuthType.BEARER,
            enable_create=True,
            enable_read=True,
            enable_update=True,
            enable_delete=False,  # Don't allow deletion of settings
            enable_list=False,    # Don't allow listing all settings
            async_operations=True,
            # Custom hooks
            pre_hooks={
                "create": [cls.validate_user_id],
                "update": [cls.update_timestamp, cls.validate_volume]
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

    @staticmethod
    async def update_timestamp(data: dict):
        """Update the updated_at timestamp"""
        data['updated_at'] = datetime.utcnow()

    @staticmethod
    async def validate_volume(data: dict):
        """Validate volume is within acceptable range"""
        volume = data.get('volume')
        if volume is not None and (volume < 0 or volume > 100):
            raise ValueError("Volume must be between 0 and 100")

    @staticmethod
    async def hide_sensitive_data(item: dict):
        """Hide sensitive data from responses"""
        # Remove internal fields if needed
        return item
