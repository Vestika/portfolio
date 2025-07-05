from .base_model import BaseFeatureModel, FeatureConfig, AuthType
from pydantic import Field
from typing import Optional


class UserPreferences(BaseFeatureModel):
    user_name: str = Field(..., min_length=1, max_length=100)
    default_portfolio_id: Optional[str] = Field(None, description="Default portfolio ID for this user")
    theme: Optional[str] = Field(default="dark", description="UI theme preference")
    currency_display: Optional[str] = Field(default="symbol", description="Currency display format")

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        return FeatureConfig(
            collection_name="user_preferences",
            auth_required=AuthType.NONE,  # For now, keeping it simple
            enable_create=True,
            enable_read=True,
            enable_update=True,
            enable_delete=True,
            enable_list=True,
            async_operations=True,
        ) 