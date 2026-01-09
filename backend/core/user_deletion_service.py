"""
User account deletion service.

Implements complete user data deletion complying with Israeli Privacy Law Amendment 13
("right to be forgotten"). This service orchestrates deletion across:
- MongoDB collections (15+ collections)
- External services (Mixpanel, Redis)
- Firebase Authentication

Architecture: 3-Phase Deletion Strategy
1. MongoDB Collections (Critical - Must Succeed)
2. External Services (Best-Effort - Log Failures)
3. Firebase Auth (Delete Last - Need Auth Until End)

Error Handling Strategy:
- Each phase wrapped in try-except - continues even if one phase fails
- Each collection deletion wrapped in try-except - continues even if one fails
- All failures logged to audit trail with detailed error messages
- Telegram notification sent to admin with comprehensive failure report
- User receives partial failure error but data is still deleted where possible
- Admin can review audit log for manual cleanup of failed operations

This ensures maximum data deletion even in failure scenarios, while maintaining
complete audit trail for compliance and manual cleanup.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from bson import ObjectId

from firebase_admin import auth as firebase_auth
from pymongo.asynchronous.database import AsyncDatabase

from models.user_model import User
from models.deletion_models import (
    DeletionResult,
    CollectionDeletionResult,
    DeletionPartialFailureException
)
from services.closing_price.database import cache
from core.analytics import get_analytics_service
from services.telegram.service import get_telegram_service

logger = logging.getLogger(__name__)


# Collections to completely delete (by user_id)
COLLECTIONS_TO_DELETE = [
    "users",
    "user_profiles",
    "user_preferences",
    "user_settings",
    "portfolios",
    "tag_libraries",
    "holding_tags",
    "custom_charts",
    "cash_flow_scenarios",
    "notifications",
    "ai_chat_sessions",
    "feedback",
    "private_configs",
    "extraction_sessions",
]


class UserDeletionService:
    """
    Service for permanently deleting user accounts and all associated data.

    This service ensures compliance with Israeli Privacy Law Amendment 13 by:
    - Deleting ALL user data across 15+ MongoDB collections
    - Removing user from Firebase Authentication
    - Cleaning up external services (Mixpanel, Redis)
    - Creating immutable audit trail
    - Handling partial failures gracefully
    """

    def __init__(self, db: AsyncDatabase):
        self.db = db
        self.analytics = get_analytics_service()
        self.telegram = get_telegram_service()

    async def delete_user_account(self, user: User) -> DeletionResult:
        """
        Permanently delete user account and all associated data.

        This is the main entry point for account deletion. It orchestrates
        the 3-phase deletion strategy and handles errors gracefully.

        Args:
            user: The user to delete

        Returns:
            DeletionResult with details of deletion

        Raises:
            DeletionPartialFailureException: If some data could not be deleted
        """
        deletion_id = ObjectId()
        audit_record = {
            "_id": deletion_id,
            "user_id": user.id,
            "firebase_uid": user.firebase_uid,
            "email": user.email,
            "requested_at": datetime.utcnow(),
            "completed_at": None,
            "status": "in_progress",
            "deleted_collections": [],
            "failed_collections": [],
            "errors": [],
            "firebase_deleted": False,
            "mixpanel_deleted": False,
            "redis_cleaned": False,
        }

        try:
            # STEP 1: Create audit log FIRST (survives even if deletion fails)
            await self.db.user_deletion_audit.insert_one(audit_record)
            logger.info(f"🗑️ [DELETION] Started deletion for user {user.email} (audit_id: {deletion_id})")

            # STEP 2: Phase 1 - Delete MongoDB collections
            # Continue even if some collections fail
            try:
                deleted_collections = await self._delete_mongodb_collections(user, audit_record)
            except Exception as e:
                logger.error(f"❌ [DELETION] Critical error in MongoDB deletion phase: {e}", exc_info=True)
                audit_record["errors"].append(f"MongoDB phase critical error: {str(e)}")

            # STEP 3: Phase 1.5 - Cleanup shared data (anonymize user references)
            # Continue even if shared data cleanup fails
            try:
                await self._cleanup_shared_data(user, audit_record)
            except Exception as e:
                logger.error(f"❌ [DELETION] Critical error in shared data cleanup: {e}", exc_info=True)
                audit_record["errors"].append(f"Shared data cleanup error: {str(e)}")

            # STEP 4: Phase 2 - External services (best-effort)
            # These already have internal try-except, but wrap for safety
            try:
                await self._delete_from_mixpanel(user, audit_record)
            except Exception as e:
                logger.error(f"❌ [DELETION] Critical error in Mixpanel deletion: {e}", exc_info=True)
                audit_record["errors"].append(f"Mixpanel critical error: {str(e)}")

            try:
                await self._delete_redis_keys(user, audit_record)
            except Exception as e:
                logger.error(f"❌ [DELETION] Critical error in Redis cleanup: {e}", exc_info=True)
                audit_record["errors"].append(f"Redis critical error: {str(e)}")

            # STEP 5: Phase 3 - Delete Firebase auth (LAST!)
            # Continue even if Firebase deletion fails
            try:
                await self._delete_firebase_auth(user, audit_record)
            except Exception as e:
                logger.error(f"❌ [DELETION] Critical error in Firebase deletion: {e}", exc_info=True)
                audit_record["errors"].append(f"Firebase critical error: {str(e)}")

            # STEP 6: Send admin notification via Telegram
            # This should never fail the deletion, already has try-except inside
            try:
                await self._send_admin_notification(user, audit_record, deletion_id)
            except Exception as e:
                logger.error(f"❌ [DELETION] Failed to send Telegram notification: {e}")
                # Don't add to errors, this is just notification

            # STEP 7: Update audit log with final status
            audit_record["completed_at"] = datetime.utcnow()

            if audit_record["failed_collections"]:
                audit_record["status"] = "partial_failure"
            else:
                audit_record["status"] = "completed"

            await self.db.user_deletion_audit.replace_one(
                {"_id": deletion_id},
                audit_record
            )

            # STEP 8: Build result and return or raise error
            total_deleted = sum(col["deleted_count"] for col in audit_record["deleted_collections"])

            result = DeletionResult(
                success=not audit_record["failed_collections"],
                audit_id=str(deletion_id),
                deleted_collections=[
                    CollectionDeletionResult(**col) for col in audit_record["deleted_collections"]
                ],
                failed_collections=audit_record["failed_collections"],
                total_deleted=total_deleted,
                firebase_deleted=audit_record["firebase_deleted"],
                mixpanel_deleted=audit_record["mixpanel_deleted"]
            )

            if audit_record["failed_collections"]:
                logger.error(
                    f"❌ [DELETION] Partial failure for user {user.email}. "
                    f"Failed collections: {audit_record['failed_collections']}"
                )
                raise DeletionPartialFailureException(
                    message="Some data could not be deleted. Please contact support.",
                    audit_id=str(deletion_id),
                    failed_collections=audit_record["failed_collections"]
                )

            logger.info(f"✅ [DELETION] Successfully deleted user {user.email} (deleted {total_deleted} records)")
            return result

        except DeletionPartialFailureException:
            raise  # Re-raise partial failure
        except Exception as e:
            logger.error(f"❌ [DELETION] Critical error deleting user {user.email}: {e}", exc_info=True)

            # Update audit log with error
            audit_record["status"] = "failed"
            audit_record["completed_at"] = datetime.utcnow()
            audit_record["errors"].append(f"Critical error: {str(e)}")

            await self.db.user_deletion_audit.replace_one(
                {"_id": deletion_id},
                audit_record
            )

            raise

    async def _delete_mongodb_collections(
        self,
        user: User,
        audit_record: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Phase 1: Delete all user data from MongoDB collections.

        This is the critical phase - if any collection fails, we log it but
        continue with others. The audit log tracks successes and failures.
        """
        logger.info(f"📦 [DELETION] Phase 1: Deleting MongoDB collections for user {user.id}")

        for collection_name in COLLECTIONS_TO_DELETE:
            try:
                collection = self.db[collection_name]
                result = await collection.delete_many({"user_id": user.id})

                audit_record["deleted_collections"].append({
                    "collection": collection_name,
                    "deleted_count": result.deleted_count
                })

                logger.debug(
                    f"  ✓ Deleted {result.deleted_count} records from {collection_name}"
                )

            except Exception as e:
                logger.error(
                    f"  ✗ Failed to delete from {collection_name}: {e}",
                    exc_info=True
                )
                audit_record["failed_collections"].append(collection_name)
                audit_record["errors"].append(f"{collection_name}: {str(e)}")

        return audit_record["deleted_collections"]

    async def _cleanup_shared_data(
        self,
        user: User,
        audit_record: Dict[str, Any]
    ) -> None:
        """
        Phase 1.5: Cleanup shared data where user is referenced but data shouldn't be deleted.

        For example:
        - shared_configs: Anonymize creator_id instead of deleting (other users may use)
        - notification_templates: Remove user from target_user_ids array
        """
        logger.info(f"🔗 [DELETION] Phase 1.5: Cleaning up shared data for user {user.id}")

        try:
            # Anonymize creator in shared_configs
            result = await self.db.shared_configs.update_many(
                {"creator_id": user.id},
                {"$set": {"creator_id": "deleted_user"}}
            )
            logger.debug(f"  ✓ Anonymized creator in {result.modified_count} shared configs")

        except Exception as e:
            logger.warning(f"  ⚠️ Failed to anonymize shared_configs: {e}")
            audit_record["errors"].append(f"shared_configs anonymization: {str(e)}")

        try:
            # Remove user from notification template targets
            result = await self.db.notification_templates.update_many(
                {"target_user_ids": user.id},
                {"$pull": {"target_user_ids": user.id}}
            )
            logger.debug(f"  ✓ Removed user from {result.modified_count} notification templates")

        except Exception as e:
            logger.warning(f"  ⚠️ Failed to cleanup notification_templates: {e}")
            audit_record["errors"].append(f"notification_templates cleanup: {str(e)}")

    async def _delete_from_mixpanel(
        self,
        user: User,
        audit_record: Dict[str, Any]
    ) -> None:
        """
        Phase 2: Delete user profile from Mixpanel using GDPR API.

        This is best-effort - if it fails, we log but don't block deletion.
        Note: Event history cannot be deleted, but user profile and PII will be removed.
        """
        logger.info(f"📊 [DELETION] Phase 2: Deleting from Mixpanel for user {user.firebase_uid}")

        try:
            if self.analytics.enabled and self.analytics.mixpanel and not self.analytics.mock_mode:
                # Use Mixpanel's people_delete method for GDPR compliance
                # This must be called synchronously, so use executor
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    self.analytics.mixpanel.people_delete,
                    user.firebase_uid
                )

                audit_record["mixpanel_deleted"] = True
                logger.info(f"  ✓ Deleted Mixpanel profile for {user.firebase_uid}")
            else:
                logger.debug(f"  ⊘ Mixpanel disabled or mock mode, skipping deletion")
                audit_record["mixpanel_deleted"] = False

        except Exception as e:
            logger.warning(f"  ⚠️ Failed to delete from Mixpanel: {e}")
            audit_record["mixpanel_deleted"] = False
            audit_record["errors"].append(f"Mixpanel deletion: {str(e)}")
            # Don't block deletion if Mixpanel fails

    async def _delete_redis_keys(
        self,
        user: User,
        audit_record: Dict[str, Any]
    ) -> None:
        """
        Phase 2: Delete user-specific keys from Redis cache.

        Current Redis usage is mostly symbol-based (not user-specific), but
        we pattern-match for any keys containing user_id just in case.
        """
        logger.info(f"🗄️ [DELETION] Phase 2: Cleaning Redis cache for user {user.id}")

        try:
            if cache.redis_client:
                # Pattern-match user-specific keys
                # Note: In production Redis, KEYS command can be slow - consider SCAN
                pattern = f"*{user.id}*"
                user_keys = await cache.redis_client.keys(pattern)

                if user_keys:
                    await cache.redis_client.delete(*user_keys)
                    logger.info(f"  ✓ Deleted {len(user_keys)} Redis keys for user")
                else:
                    logger.debug(f"  ⊘ No Redis keys found for user")

                audit_record["redis_cleaned"] = True
            else:
                logger.debug(f"  ⊘ Redis client not available, skipping")
                audit_record["redis_cleaned"] = False

        except Exception as e:
            logger.warning(f"  ⚠️ Failed to delete Redis keys: {e}")
            audit_record["redis_cleaned"] = False
            audit_record["errors"].append(f"Redis cleanup: {str(e)}")
            # Don't block deletion if Redis fails

    async def _delete_firebase_auth(
        self,
        user: User,
        audit_record: Dict[str, Any]
    ) -> None:
        """
        Phase 3: Delete user from Firebase Authentication.

        This is done LAST because we need the Firebase auth token to authorize
        the MongoDB deletion in the first place. If this fails, it's acceptable
        since the user can't log in anyway (MongoDB user record is deleted).
        """
        logger.info(f"🔥 [DELETION] Phase 3: Deleting Firebase auth for user {user.firebase_uid}")

        try:
            firebase_auth.delete_user(user.firebase_uid)
            audit_record["firebase_deleted"] = True
            logger.info(f"  ✓ Deleted Firebase user {user.firebase_uid}")

        except Exception as e:
            logger.warning(f"  ⚠️ Failed to delete Firebase user: {e}")
            audit_record["firebase_deleted"] = False
            audit_record["errors"].append(f"Firebase deletion: {str(e)}")
            # Don't block deletion if Firebase fails - user can't log in anyway

    async def _send_admin_notification(
        self,
        user: User,
        audit_record: Dict[str, Any],
        deletion_id: ObjectId
    ) -> None:
        """
        Send Telegram notification to admin when user deletes account.

        This is informational only - failure doesn't block deletion.
        Includes detailed failure information for admin review.
        """
        logger.info(f"📱 [DELETION] Sending Telegram notification for user {user.email}")

        try:
            # Determine overall status emoji
            if not audit_record["failed_collections"] and audit_record["firebase_deleted"]:
                status_emoji = "✅"
                status_text = "COMPLETE"
            elif audit_record["failed_collections"]:
                status_emoji = "⚠️"
                status_text = "PARTIAL"
            else:
                status_emoji = "❌"
                status_text = "FAILED"

            # Build detailed message
            message = (
                f"{status_emoji} Account Deletion: {status_text}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"Email: {user.email}\n"
                f"User ID: {user.id}\n"
                f"Firebase UID: {user.firebase_uid}\n"
                f"Audit ID: {deletion_id}\n"
                f"Time: {datetime.utcnow().isoformat()}\n"
                f"\n"
                f"📊 RESULTS:\n"
                f"• Collections deleted: {len(audit_record['deleted_collections'])}/{len(COLLECTIONS_TO_DELETE)}\n"
                f"• Failed collections: {len(audit_record['failed_collections'])}\n"
                f"• Firebase deleted: {'✅' if audit_record['firebase_deleted'] else '❌'}\n"
                f"• Mixpanel deleted: {'✅' if audit_record['mixpanel_deleted'] else '⚠️ N/A'}\n"
                f"• Redis cleaned: {'✅' if audit_record.get('redis_cleaned', False) else '⚠️ N/A'}"
            )

            # Add detailed failure information
            if audit_record["failed_collections"]:
                message += f"\n\n⚠️ FAILED COLLECTIONS:\n"
                for collection in audit_record["failed_collections"]:
                    message += f"• {collection}\n"

            # Add error messages if any
            if audit_record.get("errors"):
                message += f"\n❌ ERRORS:\n"
                # Limit to first 3 errors to avoid message being too long
                for error in audit_record["errors"][:3]:
                    # Truncate long error messages
                    error_short = error[:100] + "..." if len(error) > 100 else error
                    message += f"• {error_short}\n"

                if len(audit_record["errors"]) > 3:
                    message += f"• ... and {len(audit_record['errors']) - 3} more errors\n"

            # Add call to action for partial failures
            if audit_record["failed_collections"]:
                message += f"\n⚠️ ACTION REQUIRED: Manual cleanup needed. Check audit log: {deletion_id}"

            success = await self.telegram.send_text(message)

            if success:
                logger.info(f"  ✓ Sent detailed Telegram notification to admin")
            else:
                logger.warning(f"  ⚠️ Failed to send Telegram notification (no config or error)")

        except Exception as e:
            logger.warning(f"  ⚠️ Exception sending Telegram notification: {e}")
            # Don't block deletion if Telegram fails
