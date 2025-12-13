"""
Notification service for managing user notifications.
Handles creation, delivery, and management of various notification types.
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from bson import ObjectId
from models.notification_model import (
    Notification, NotificationType, NotificationStatus,
    DisplayType, DismissalType, DistributionType,
    NotificationTemplate, DEFAULT_NOTIFICATION_TEMPLATES,
    substitute_variables, extract_variables
)
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

    def _get_templates_collection(self):
        """Get the notification_templates collection"""
        return db_manager.get_collection("notification_templates")

    # ==================== Template CRUD Methods ====================

    async def create_template(
        self,
        template_id: str,
        notification_type: NotificationType,
        title_template: str,
        message_template: str,
        distribution_type: DistributionType = DistributionType.PULL,
        display_type: DisplayType = DisplayType.BOTH,
        dismissal_type: DismissalType = DismissalType.ONCE,
        expires_in_days: Optional[int] = None,
        link_url: Optional[str] = None,
        link_text: Optional[str] = None,
        required_variables: Optional[List[str]] = None,
        created_by: Optional[str] = None,
        target_user_ids: Optional[List[str]] = None,
        target_filter: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a new notification template"""
        try:
            collection = self._get_templates_collection()

            # Check if template already exists
            existing = await collection.find_one({"template_id": template_id})
            if existing:
                raise ValueError(f"Template with id '{template_id}' already exists")

            # Auto-detect available variables from templates
            available_variables = list(set(
                extract_variables(title_template) +
                extract_variables(message_template)
            ))

            template = {
                "template_id": template_id,
                "notification_type": notification_type.value if isinstance(notification_type, NotificationType) else notification_type,
                "title_template": title_template,
                "message_template": message_template,
                "available_variables": available_variables,
                "required_variables": required_variables or [],
                "distribution_type": distribution_type.value if isinstance(distribution_type, DistributionType) else distribution_type,
                "display_type": display_type.value if isinstance(display_type, DisplayType) else display_type,
                "dismissal_type": dismissal_type.value if isinstance(dismissal_type, DismissalType) else dismissal_type,
                "expires_in_days": expires_in_days,
                "link_url": link_url,
                "link_text": link_text or "Check it out",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "created_by": created_by,
                "target_user_ids": target_user_ids,
                "target_filter": target_filter,
                "push_completed_at": None,
                "push_user_count": None
            }

            result = await collection.insert_one(template)
            template["_id"] = str(result.inserted_id)
            logger.info(f"Created notification template '{template_id}'")
            return template
        except Exception as e:
            logger.error(f"Failed to create template: {e}")
            raise

    async def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get a template by its ID"""
        try:
            collection = self._get_templates_collection()
            template = await collection.find_one({"template_id": template_id})
            if template:
                template["_id"] = str(template["_id"])
                if template.get("created_at"):
                    template["created_at"] = template["created_at"].isoformat()
                if template.get("push_completed_at"):
                    template["push_completed_at"] = template["push_completed_at"].isoformat()
            return template
        except Exception as e:
            logger.error(f"Failed to get template {template_id}: {e}")
            raise

    async def list_templates(self, include_inactive: bool = False) -> List[Dict[str, Any]]:
        """List all notification templates"""
        try:
            collection = self._get_templates_collection()
            query = {} if include_inactive else {"is_active": True}
            cursor = collection.find(query).sort("created_at", -1)
            templates = await cursor.to_list(length=100)

            for template in templates:
                template["_id"] = str(template["_id"])
                if template.get("created_at"):
                    template["created_at"] = template["created_at"].isoformat()
                if template.get("push_completed_at"):
                    template["push_completed_at"] = template["push_completed_at"].isoformat()

            return templates
        except Exception as e:
            logger.error(f"Failed to list templates: {e}")
            raise

    async def update_template(
        self,
        template_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update a template (only PULL/TRIGGER types or PUSH not yet completed)"""
        try:
            collection = self._get_templates_collection()
            template = await collection.find_one({"template_id": template_id})

            if not template:
                raise ValueError(f"Template '{template_id}' not found")

            # Don't allow updates to PUSH templates that have completed
            if (template.get("distribution_type") == DistributionType.PUSH.value and
                template.get("push_completed_at") is not None):
                raise ValueError("Cannot update PUSH template after distribution is complete")

            # Filter allowed update fields
            allowed_fields = {
                "title_template", "message_template", "display_type",
                "dismissal_type", "expires_in_days", "link_url", "link_text",
                "required_variables", "is_active"
            }
            filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}

            # Re-extract variables if templates changed
            if "title_template" in filtered_updates or "message_template" in filtered_updates:
                title = filtered_updates.get("title_template", template["title_template"])
                message = filtered_updates.get("message_template", template["message_template"])
                filtered_updates["available_variables"] = list(set(
                    extract_variables(title) + extract_variables(message)
                ))

            result = await collection.update_one(
                {"template_id": template_id},
                {"$set": filtered_updates}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update template {template_id}: {e}")
            raise

    async def deactivate_template(self, template_id: str) -> bool:
        """Soft delete a template by setting is_active to False"""
        try:
            collection = self._get_templates_collection()
            result = await collection.update_one(
                {"template_id": template_id},
                {"$set": {"is_active": False}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to deactivate template {template_id}: {e}")
            raise

    async def seed_default_templates(self) -> int:
        """Seed default notification templates if they don't exist"""
        try:
            collection = self._get_templates_collection()
            created_count = 0

            for template_data in DEFAULT_NOTIFICATION_TEMPLATES:
                existing = await collection.find_one({"template_id": template_data["template_id"]})
                if not existing:
                    # Convert enums to values for storage
                    template_doc = {
                        **template_data,
                        "notification_type": template_data["notification_type"].value,
                        "distribution_type": template_data["distribution_type"].value,
                        "display_type": template_data["display_type"].value,
                        "dismissal_type": template_data["dismissal_type"].value,
                        "created_at": datetime.utcnow(),
                        "created_by": None,
                        "expires_in_days": None,
                        "link_url": None,
                        "link_text": "Check it out",
                        "push_completed_at": None,
                        "push_user_count": None
                    }
                    await collection.insert_one(template_doc)
                    created_count += 1
                    logger.info(f"Seeded default template: {template_data['template_id']}")

            return created_count
        except Exception as e:
            logger.error(f"Failed to seed default templates: {e}")
            raise

    # ==================== Notification Generation Methods ====================

    def _generate_from_template(
        self,
        template: Dict[str, Any],
        user_id: str,
        variables: Dict[str, Any]
    ) -> Notification:
        """Generate a notification from a template with variable substitution"""
        # Substitute variables in title and message
        title = substitute_variables(template["title_template"], variables)
        message = substitute_variables(template["message_template"], variables)

        # Calculate expiry if expires_in_days is set
        expires_at = None
        if template.get("expires_in_days"):
            expires_at = datetime.utcnow() + timedelta(days=template["expires_in_days"])

        return Notification(
            user_id=user_id,
            type=NotificationType(template["notification_type"]),
            title=title,
            message=message,
            template_id=template["template_id"],
            display_type=DisplayType(template.get("display_type", "both")),
            dismissal_type=DismissalType(template.get("dismissal_type", "once")),
            expires_at=expires_at,
            link_url=template.get("link_url"),
            link_text=template.get("link_text"),
            metadata={"variables": variables, "template_id": template["template_id"]}
        )

    async def trigger_notification_from_template(
        self,
        template_id: str,
        user_id: str,
        variables: Dict[str, Any]
    ) -> Optional[str]:
        """
        Create a notification from a TRIGGER-type template.
        Called by event handlers (RSU vesting, welcome, etc.)
        """
        try:
            template = await self.get_template(template_id)

            if not template:
                logger.warning(f"Template {template_id} not found")
                return None

            if not template.get("is_active", True):
                logger.warning(f"Template {template_id} is inactive")
                return None

            # Validate required variables
            required = template.get("required_variables", [])
            missing = [v for v in required if v not in variables]
            if missing:
                raise ValueError(f"Missing required variables for template {template_id}: {missing}")

            # Check for duplicate (user already has notification from this template)
            collection = self._get_collection()
            existing = await collection.find_one({
                "user_id": user_id,
                "template_id": template_id
            })

            if existing:
                logger.debug(f"User {user_id} already has notification from template {template_id}")
                return str(existing["_id"])

            notification = self._generate_from_template(template, user_id, variables)
            return await self.create_notification(notification)
        except Exception as e:
            logger.error(f"Failed to trigger notification from template {template_id}: {e}")
            raise

    async def _user_matches_filter(self, firebase_uid: str, target_filter: Dict[str, Any]) -> bool:
        """
        Check if a user matches the target filter criteria.

        Supported filters:
        - has_holding: str - User has a holding with this symbol
        - has_account_type: str - User has an account of this type
        - has_portfolio: bool - User has at least one portfolio

        Note: firebase_uid is used for notification storage, but portfolios use MongoDB user ID.
        This method looks up the MongoDB ID from firebase_uid for portfolio queries.
        """
        try:
            # Look up the user's MongoDB ID from firebase_uid
            users_collection = db_manager.get_collection("users")
            user_doc = await users_collection.find_one({"firebase_uid": firebase_uid})
            if not user_doc:
                logger.warning(f"User with firebase_uid {firebase_uid} not found")
                return False

            # Portfolios are stored with MongoDB user ID (string of ObjectId)
            mongo_user_id = str(user_doc["_id"])

            portfolios_collection = db_manager.get_collection("portfolios")

            # Check has_holding filter
            if "has_holding" in target_filter:
                symbol = target_filter["has_holding"]
                portfolio = await portfolios_collection.find_one({
                    "user_id": mongo_user_id,
                    "accounts.holdings.symbol": symbol
                })
                if not portfolio:
                    return False

            # Check has_account_type filter
            if "has_account_type" in target_filter:
                account_type = target_filter["has_account_type"]
                portfolio = await portfolios_collection.find_one({
                    "user_id": mongo_user_id,
                    "accounts.account_type": account_type
                })
                if not portfolio:
                    return False

            # Check has_portfolio filter
            if target_filter.get("has_portfolio"):
                portfolio = await portfolios_collection.find_one({"user_id": mongo_user_id})
                if not portfolio:
                    return False

            return True
        except Exception as e:
            logger.warning(f"Error checking filter for user {firebase_uid}: {e}")
            return False

    async def push_distribute_template(self, template_id: str) -> int:
        """
        Distribute notification to targeted users immediately.
        Called as background task for PUSH distribution type.

        Supports targeting via:
        - target_user_ids: List of specific user IDs
        - target_filter: Filter criteria (has_holding, has_account_type, etc.)
        - If neither specified, targets all users
        """
        try:
            template = await self.get_template(template_id)
            if not template:
                raise ValueError(f"Template {template_id} not found")

            users_collection = db_manager.get_collection("users")
            notifications_collection = self._get_collection()
            templates_collection = self._get_templates_collection()

            target_user_ids = template.get("target_user_ids")
            target_filter = template.get("target_filter")

            # Get users based on targeting
            if target_user_ids:
                # Specific users targeted
                users = await users_collection.find({
                    "firebase_uid": {"$in": target_user_ids}
                }).to_list(length=None)
                logger.info(f"Targeting {len(users)} specific users for template {template_id}")
            else:
                # All users (will be filtered if target_filter exists)
                users = await users_collection.find({}).to_list(length=None)

            created_count = 0
            skipped_filter_count = 0

            for user in users:
                user_id = user.get("firebase_uid")
                if not user_id:
                    continue

                # Apply target_filter if specified
                if target_filter and not await self._user_matches_filter(user_id, target_filter):
                    skipped_filter_count += 1
                    continue

                # Check if user already has this notification
                existing = await notifications_collection.find_one({
                    "user_id": user_id,
                    "template_id": template_id
                })

                if not existing:
                    # Get user name for variable substitution
                    variables = {"user_name": user.get("name", "User")}
                    notification = self._generate_from_template(template, user_id, variables)
                    await notifications_collection.insert_one(notification.dict())
                    created_count += 1

            # Update template with push status
            await templates_collection.update_one(
                {"template_id": template_id},
                {"$set": {
                    "push_completed_at": datetime.utcnow(),
                    "push_user_count": created_count
                }}
            )

            logger.info(f"Push distributed template {template_id} to {created_count} users (skipped {skipped_filter_count} due to filter)")
            return created_count
        except Exception as e:
            logger.error(f"Failed to push distribute template {template_id}: {e}")
            raise

    async def sync_templates_for_user(self, user_id: str, user_name: str = "User") -> List[str]:
        """
        Sync all PULL-type templates to a user.
        Creates notifications for any templates they don't have.
        Respects targeting configuration (target_user_ids and target_filter).
        """
        notification_ids = []

        try:
            collection = self._get_templates_collection()

            # Get all active PULL templates
            templates = await collection.find({
                "is_active": True,
                "distribution_type": DistributionType.PULL.value
            }).to_list(length=100)

            for template in templates:
                # Check targeting: if target_user_ids specified, user must be in list
                target_user_ids = template.get("target_user_ids")
                if target_user_ids and user_id not in target_user_ids:
                    logger.debug(f"Skipping template {template['template_id']} - user {user_id} not in target list")
                    continue

                # Check targeting: if target_filter specified, user must match filter
                target_filter = template.get("target_filter")
                if target_filter and not await self._user_matches_filter(user_id, target_filter):
                    logger.debug(f"Skipping template {template['template_id']} - user {user_id} doesn't match filter")
                    continue

                # Check if user already has this notification
                existing = await self._get_collection().find_one({
                    "user_id": user_id,
                    "template_id": template["template_id"]
                })

                if not existing:
                    variables = {"user_name": user_name}
                    notification = self._generate_from_template(template, user_id, variables)
                    result = await self._get_collection().insert_one(notification.dict())
                    notification_ids.append(str(result.inserted_id))
                    logger.debug(f"Synced template {template['template_id']} to user {user_id}")

            return notification_ids
        except Exception as e:
            logger.error(f"Failed to sync templates for user {user_id}: {e}")
            return []
    
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
        """Create a welcome notification for a new user using template system"""
        # Check if user already has a welcome notification
        collection = self._get_collection()
        existing = await collection.find_one({
            "user_id": user_id,
            "$or": [
                {"type": NotificationType.WELCOME},
                {"template_id": "welcome"}
            ]
        })

        if existing:
            logger.info(f"User {user_id} already has a welcome notification")
            return str(existing["_id"])

        # Try to use template first
        template = await self.get_template("welcome")
        if template and template.get("is_active"):
            result = await self.trigger_notification_from_template(
                template_id="welcome",
                user_id=user_id,
                variables={"user_name": user_name}
            )
            if result:
                return result

        # Fallback to legacy factory method
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
        """Create an RSU vesting notification using template system"""
        variables = {
            "symbol": symbol,
            "units": units,
            "vest_date": vest_date,
            "account_name": account_name
        }

        # Try to use template first
        template = await self.get_template("rsu_vesting")
        if template and template.get("is_active"):
            # For RSU notifications, we need unique per event, not per template
            # So we check by metadata instead of template_id
            collection = self._get_collection()
            existing = await collection.find_one({
                "user_id": user_id,
                "type": NotificationType.RSU_VESTING,
                "metadata.symbol": symbol,
                "metadata.variables.vest_date": vest_date
            })
            if existing:
                return str(existing["_id"])

            notification = self._generate_from_template(template, user_id, variables)
            # Update metadata to include RSU-specific data for deduplication
            notification.metadata = {
                **notification.metadata,
                "symbol": symbol,
                "units": units,
                "vest_date": vest_date,
                "account_name": account_name,
                "event_type": "vesting"
            }
            return await self.create_notification(notification)

        # Fallback to legacy factory method
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
        """Create an RSU grant notification using template system"""
        variables = {
            "symbol": symbol,
            "units": units,
            "grant_date": grant_date,
            "account_name": account_name
        }

        # Try to use template first
        template = await self.get_template("rsu_grant")
        if template and template.get("is_active"):
            notification = self._generate_from_template(template, user_id, variables)
            # Update metadata to include RSU-specific data
            notification.metadata = {
                **notification.metadata,
                "symbol": symbol,
                "units": units,
                "grant_date": grant_date,
                "account_name": account_name,
                "event_type": "grant"
            }
            return await self.create_notification(notification)

        # Fallback to legacy factory method
        notification = Notification.create_rsu_grant_notification(
            user_id, symbol, units, grant_date, account_name
        )
        return await self.create_notification(notification)

    async def create_feature_notification_for_user(
        self,
        user_id: str,
        feature_id: str,
        title: str,
        message: str,
        display_type: DisplayType = DisplayType.BOTH,
        dismissal_type: DismissalType = DismissalType.ONCE,
        expires_at: Optional[datetime] = None,
        link_url: Optional[str] = None,
        link_text: Optional[str] = None
    ) -> Optional[str]:
        """Create a feature notification for a specific user if they don't already have it"""
        collection = self._get_collection()

        # Check if user already has this feature notification
        existing = await collection.find_one({
            "user_id": user_id,
            "type": NotificationType.FEATURE,
            "feature_id": feature_id
        })

        if existing:
            logger.debug(f"User {user_id} already has feature notification for {feature_id}")
            return None

        notification = Notification.create_feature_notification(
            user_id=user_id,
            feature_id=feature_id,
            title=title,
            message=message,
            display_type=display_type,
            dismissal_type=dismissal_type,
            expires_at=expires_at,
            link_url=link_url,
            link_text=link_text
        )
        return await self.create_notification(notification)

    async def get_active_feature_announcements(self) -> List[Dict[str, Any]]:
        """Get all active feature announcements (templates) from the feature_announcements collection"""
        try:
            collection = db_manager.get_collection("feature_announcements")
            now = datetime.utcnow()

            # Find announcements that are active (not expired)
            query = {
                "$or": [
                    {"expires_at": None},
                    {"expires_at": {"$gt": now}}
                ]
            }

            cursor = collection.find(query).sort("created_at", -1)
            announcements = await cursor.to_list(length=100)

            for announcement in announcements:
                announcement["_id"] = str(announcement["_id"])
                if announcement.get("created_at"):
                    announcement["created_at"] = announcement["created_at"].isoformat()
                if announcement.get("expires_at"):
                    announcement["expires_at"] = announcement["expires_at"].isoformat()

            return announcements
        except Exception as e:
            logger.error(f"Failed to get active feature announcements: {e}")
            return []

    async def create_feature_announcement(
        self,
        feature_id: str,
        title: str,
        message: str,
        display_type: str = "both",
        dismissal_type: str = "once",
        expires_in_days: Optional[int] = None,
        link_url: Optional[str] = None,
        link_text: Optional[str] = None
    ) -> str:
        """Create a feature announcement template that will be distributed to all users"""
        try:
            collection = db_manager.get_collection("feature_announcements")

            expires_at = None
            if expires_in_days:
                from datetime import timedelta
                expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

            announcement = {
                "feature_id": feature_id,
                "title": title,
                "message": message,
                "display_type": display_type,
                "dismissal_type": dismissal_type,
                "expires_at": expires_at,
                "link_url": link_url,
                "link_text": link_text or "Check it out",
                "created_at": datetime.utcnow()
            }

            result = await collection.insert_one(announcement)
            logger.info(f"Created feature announcement {result.inserted_id} for feature {feature_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create feature announcement: {e}")
            raise

    async def sync_feature_notifications_for_user(self, user_id: str) -> List[str]:
        """Sync feature announcements to a user - creates notifications for any they don't have"""
        notification_ids = []

        try:
            announcements = await self.get_active_feature_announcements()

            for announcement in announcements:
                notification_id = await self.create_feature_notification_for_user(
                    user_id=user_id,
                    feature_id=announcement["feature_id"],
                    title=announcement["title"],
                    message=announcement["message"],
                    display_type=DisplayType(announcement.get("display_type", "both")),
                    dismissal_type=DismissalType(announcement.get("dismissal_type", "once")),
                    expires_at=datetime.fromisoformat(announcement["expires_at"]) if announcement.get("expires_at") else None,
                    link_url=announcement.get("link_url"),
                    link_text=announcement.get("link_text")
                )
                if notification_id:
                    notification_ids.append(notification_id)

            return notification_ids
        except Exception as e:
            logger.error(f"Failed to sync feature notifications for user {user_id}: {e}")
            return []

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
