"""
Notification service for managing user notifications.
Handles creation, delivery, and management of various notification types.
"""
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from bson import ObjectId
from models.notification_model import Notification, NotificationType, NotificationStatus
from core.database import db_manager
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing user notifications"""
    
    def __init__(self):
        pass
    
    def _get_collection(self):
        """Get the notifications collection"""
        return db_manager.get_collection("notifications")
    
    async def create_notification(self, notification: Notification) -> str:
        """Create a new notification"""
        try:
            collection = self._get_collection()
            result = await collection.insert_one(notification.dict())
            logger.info(f"Created notification {result.inserted_id} for user {notification.user_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create notification: {e}")
            raise

    async def get_user_notifications(
        self,
        user_id: str,
        limit: int = 50,
        include_archived: bool = False
    ) -> List[Dict[str, Any]]:
        """Get notifications for a user"""
        try:
            collection = self._get_collection()
            query = {"user_id": user_id}
            if not include_archived:
                query["status"] = {"$ne": NotificationStatus.ARCHIVED}

            cursor = collection.find(query).sort("created_at", -1).limit(limit)
            notifications = await cursor.to_list(length=limit)

            # Convert ObjectId to string for JSON serialization
            for notification in notifications:
                notification["_id"] = str(notification["_id"])
                if notification.get("created_at"):
                    notification["created_at"] = notification["created_at"].isoformat()
                if notification.get("read_at"):
                    notification["read_at"] = notification["read_at"].isoformat()
                if notification.get("archived_at"):
                    notification["archived_at"] = notification["archived_at"].isoformat()

            return notifications
        except Exception as e:
            logger.error(f"Failed to get notifications for user {user_id}: {e}")
            raise

    async def mark_notification_read(self, notification_id: str, user_id: str) -> bool:
        """Mark a notification as read"""
        try:
            collection = self._get_collection()
            result = await collection.update_one(
                {"_id": ObjectId(notification_id), "user_id": user_id},
                {
                    "$set": {
                        "status": NotificationStatus.READ,
                        "read_at": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to mark notification {notification_id} as read: {e}")
            raise

    async def mark_all_notifications_read(self, user_id: str) -> int:
        """Mark all unread notifications as read for a user"""
        try:
            collection = self._get_collection()
            result = await collection.update_many(
                {"user_id": user_id, "status": NotificationStatus.UNREAD},
                {
                    "$set": {
                        "status": NotificationStatus.READ,
                        "read_at": datetime.utcnow()
                    }
                }
            )
            logger.info(f"Marked {result.modified_count} notifications as read for user {user_id}")
            return result.modified_count
        except Exception as e:
            logger.error(f"Failed to mark all notifications as read for user {user_id}: {e}")
            raise

    async def archive_notification(self, notification_id: str, user_id: str) -> bool:
        """Archive a notification"""
        try:
            collection = self._get_collection()
            result = await collection.update_one(
                {"_id": ObjectId(notification_id), "user_id": user_id},
                {
                    "$set": {
                        "status": NotificationStatus.ARCHIVED,
                        "archived_at": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to archive notification {notification_id}: {e}")
            raise

    async def get_unread_count(self, user_id: str) -> int:
        """Get count of unread notifications for a user"""
        try:
            collection = self._get_collection()
            count = await collection.count_documents({
                "user_id": user_id,
                "status": NotificationStatus.UNREAD
            })
            return count
        except Exception as e:
            logger.error(f"Failed to get unread count for user {user_id}: {e}")
            raise

    async def create_welcome_notification(self, user_id: str, user_name: str) -> str:
        """Create a welcome notification for a new user"""
        # Check if user already has a welcome notification
        collection = self._get_collection()
        existing = await collection.find_one({
            "user_id": user_id,
            "type": NotificationType.WELCOME
        })

        if existing:
            logger.info(f"User {user_id} already has a welcome notification")
            return str(existing["_id"])

        notification = Notification.create_welcome_notification(user_id, user_name)
        return await self.create_notification(notification)

    async def create_rsu_vesting_notification(
        self,
        user_id: str,
        symbol: str,
        units: float,
        vest_date: str,
        account_name: str
    ) -> str:
        """Create an RSU vesting notification"""
        notification = Notification.create_rsu_vesting_notification(
            user_id, symbol, units, vest_date, account_name
        )
        return await self.create_notification(notification)

    async def create_rsu_grant_notification(
        self,
        user_id: str,
        symbol: str,
        units: float,
        grant_date: str,
        account_name: str
    ) -> str:
        """Create an RSU grant notification"""
        notification = Notification.create_rsu_grant_notification(
            user_id, symbol, units, grant_date, account_name
        )
        return await self.create_notification(notification)

    async def check_rsu_vesting_events(self, user_id: str, portfolio_data: Dict[str, Any]) -> List[str]:
        """Check for RSU vesting events and create notifications"""
        notification_ids = []

        try:
            # Get today's date
            today = date.today()

            # Check each account for RSU vesting events
            for account in portfolio_data.get("accounts", []):
                if account.get("account_type") != "company-custodian-account":
                    continue

                account_name = account.get("account_name", "")
                rsu_vesting_data = account.get("rsu_vesting_data", [])

                for rsu_plan in rsu_vesting_data:
                    # Check if there's a vesting event today
                    schedule = rsu_plan.get("schedule", [])
                    next_vest_date = None
                    if len(schedule) > 0:
                        next_vest_date = schedule[0].get('date')
                    if next_vest_date:
                        units = schedule[0].get('units')
                        try:
                            vest_date = datetime.strptime(next_vest_date, "%Y-%m-%d").date()
                            if vest_date == today:
                                # Create notification for vesting event
                                symbol = rsu_plan.get("symbol", "Unknown")

                                # Check if we already created a notification for this event today
                                collection = self._get_collection()
                                existing = await collection.find_one({
                                    "user_id": user_id,
                                    "type": NotificationType.RSU_VESTING,
                                    "metadata.symbol": symbol,
                                    "metadata.vest_date": next_vest_date,
                                    "created_at": {
                                        "$gte": datetime.combine(today, datetime.min.time()),
                                        "$lt": datetime.combine(today, datetime.max.time())
                                    }
                                })
                                
                                if not existing:
                                    notification_id = await self.create_rsu_vesting_notification(
                                        user_id, symbol, units, next_vest_date, account_name
                                    )
                                    notification_ids.append(notification_id)
                                    logger.info(f"Created RSU vesting notification for {symbol} on {next_vest_date}")
                                
                        except ValueError as e:
                            logger.warning(f"Invalid vest date format: {next_vest_date}, error: {e}")
                            continue
            
            return notification_ids
            
        except Exception as e:
            logger.error(f"Failed to check RSU vesting events for user {user_id}: {e}")
            raise


# Global notification service instance
_notification_service = None

def get_notification_service() -> NotificationService:
    """Get the global notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
