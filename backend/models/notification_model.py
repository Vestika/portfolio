from .base_model import BaseFeatureModel, FeatureConfig, AuthType
from pydantic import Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class NotificationType(str, Enum):
    WELCOME = "welcome"
    RSU_VESTING = "rsu_vesting"
    RSU_GRANT = "rsu_grant"
    OPTIONS_VESTING = "options_vesting"
    PORTFOLIO_UPDATE = "portfolio_update"
    SYSTEM = "system"


class NotificationStatus(str, Enum):
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"


class Notification(BaseFeatureModel):
    user_id: str = Field(..., description="Firebase UID of the user")
    type: NotificationType = Field(..., description="Type of notification")
    title: str = Field(..., min_length=1, max_length=200, description="Notification title")
    message: str = Field(..., min_length=1, max_length=1000, description="Notification message")
    status: NotificationStatus = Field(default=NotificationStatus.UNREAD, description="Read status")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional data for the notification")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="When notification was created")
    read_at: Optional[datetime] = Field(default=None, description="When notification was read")
    archived_at: Optional[datetime] = Field(default=None, description="When notification was archived")

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        return FeatureConfig(
            collection_name="notifications",
            auth_required=AuthType.BEARER,
            enable_create=True,
            enable_read=True,
            enable_update=True,
            enable_delete=True,
            enable_list=True,
            async_operations=True,
            # Custom hooks for additional logic
            pre_hooks={
                "create": [cls.validate_user_notification],
                "update": [cls.handle_status_change]
            },
            post_hooks={
                "read": [cls.track_read_time],
                "list": [cls.filter_by_user]
            }
        )

    @staticmethod
    async def validate_user_notification(data: dict):
        """Custom pre-hook to validate user notification creation"""
        if not data.get('user_id'):
            raise ValueError("user_id is required for notifications")
        if not data.get('type'):
            raise ValueError("type is required for notifications")
        if not data.get('title'):
            raise ValueError("title is required for notifications")
        if not data.get('message'):
            raise ValueError("message is required for notifications")

    @staticmethod
    def handle_status_change(item_id: str, data: dict):
        """Custom pre-hook to handle status changes"""
        if 'status' in data:
            if data['status'] == NotificationStatus.READ and 'read_at' not in data:
                data['read_at'] = datetime.utcnow()
            elif data['status'] == NotificationStatus.ARCHIVED and 'archived_at' not in data:
                data['archived_at'] = datetime.utcnow()

    @staticmethod
    async def track_read_time(item: dict):
        """Custom post-hook to track read time"""
        if item.get('status') == NotificationStatus.READ and not item.get('read_at'):
            item['read_at'] = datetime.utcnow().isoformat()
        return item

    @staticmethod
    async def filter_by_user(items: list):
        """Custom post-hook to filter notifications by user"""
        # This will be handled by the API layer with proper authentication
        return items

    @classmethod
    def create_welcome_notification(cls, user_id: str, user_name: str) -> 'Notification':
        """Create a welcome notification for a new user"""
        return cls(
            user_id=user_id,
            type=NotificationType.WELCOME,
            title="Welcome to Vestika!",
            message=f"Welcome {user_name}! Start by creating your first portfolio to track your investments.",
            metadata={
                "is_welcome": True,
                "user_name": user_name
            }
        )

    @classmethod
    def create_rsu_vesting_notification(
        cls,
        user_id: str,
        symbol: str,
        units: float,
        vest_date: str,
        account_name: str
    ) -> 'Notification':
        """Create an RSU vesting notification"""
        return cls(
            user_id=user_id,
            type=NotificationType.RSU_VESTING,
            title="RSU Vesting Event",
            message=f"Your RSUs for {symbol} have vested! {units} units are now available in your {account_name} account.",
            metadata={
                "symbol": symbol,
                "units": units,
                "vest_date": vest_date,
                "account_name": account_name,
                "event_type": "vesting"
            }
        )

    @classmethod
    def create_rsu_grant_notification(
        cls,
        user_id: str,
        symbol: str,
        units: float,
        grant_date: str,
        account_name: str
    ) -> 'Notification':
        """Create an RSU grant notification"""
        return cls(
            user_id=user_id,
            type=NotificationType.RSU_GRANT,
            title="New RSU Grant",
            message=f"You've been granted {units} RSU units of {symbol} in your {account_name} account.",
            metadata={
                "symbol": symbol,
                "units": units,
                "grant_date": grant_date,
                "account_name": account_name,
                "event_type": "grant"
            }
        )
