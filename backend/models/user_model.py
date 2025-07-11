from .base_model import BaseFeatureModel, FeatureConfig, AuthType
from pydantic import Field
from typing import Optional


class User(BaseFeatureModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str
    firebase_uid: str

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        return FeatureConfig(
            collection_name="users",
            auth_required=AuthType.BEARER,
            enable_create=True,
            enable_read=True,
            enable_update=True,
            enable_delete=True,
            enable_list=True,
            async_operations=True,
            # Custom hooks for additional logic
            pre_hooks={
                "create": [cls.validate_email_unique],
                "update": [cls.log_update]
            },
            post_hooks={
                "read": [cls.hide_sensitive_data],
                "list": [cls.add_computed_fields]
            },
            custom_validators={
                "create": cls.validate_user_creation
            }
        )

    @staticmethod
    async def validate_email_unique(data: dict):
        """Custom pre-hook to validate email uniqueness"""
        # Add your email validation logic here
        pass

    @staticmethod
    def log_update(item_id: str, data: dict):
        """Custom pre-hook to log updates"""
        print(f"Updating user {item_id} with data: {data}")

    @staticmethod
    async def hide_sensitive_data(item: dict):
        """Custom post-hook to hide sensitive data"""
        # Remove or mask sensitive fields
        return item

    @staticmethod
    async def add_computed_fields(items: list):
        """Custom post-hook to add computed fields"""
        for item in items:
            item['display_name'] = f"{item.get('name', 'Unknown')} ({item.get('email', 'No email')})"
        return items

    @staticmethod
    def validate_user_creation(data: dict):
        """Custom validator for user creation"""
        if not data.get('name'):
            raise ValueError("Name is required")
