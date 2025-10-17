from .base_model import BaseFeatureModel
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
