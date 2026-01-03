"""
Notification API endpoints for managing user notifications.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from core.auth import get_current_user
from core.notification_service import get_notification_service
from models.notification_model import (
    Notification, NotificationStatus, NotificationType,
    DistributionType, DisplayType, DismissalType
)
from loguru import logger


class CreateNotificationTemplateRequest(BaseModel):
    """Request to create a notification template"""
    template_id: str = Field(..., description="Unique identifier for this template")
    notification_type: str = Field(default="feature", description="Type: welcome, feature, rsu_vesting, etc.")
    title_template: str = Field(..., description="Title with {variable} placeholders")
    message_template: str = Field(..., description="Message with {variable} placeholders")
    distribution_type: str = Field(default="pull", description="Distribution: push, pull, or trigger")
    display_type: str = Field(default="both", description="Display: popup, bell, or both")
    dismissal_type: str = Field(default="once", description="Dismissal: once, until_clicked, or auto_expire")
    expires_in_days: Optional[int] = Field(default=None, description="Days until notification expires")
    link_url: Optional[str] = Field(default=None, description="URL to navigate to")
    link_text: Optional[str] = Field(default=None, description="Button text for link")
    required_variables: Optional[List[str]] = Field(default=None, description="Required variables for trigger type")
    # Targeting options
    target_user_ids: Optional[List[str]] = Field(default=None, description="Specific Firebase UIDs to target (if None, targets all users)")
    target_filter: Optional[Dict[str, Any]] = Field(default=None, description="Filter criteria: has_holding, has_account_type, has_portfolio")


class UpdateNotificationTemplateRequest(BaseModel):
    """Request to update a notification template"""
    title_template: Optional[str] = None
    message_template: Optional[str] = None
    display_type: Optional[str] = None
    dismissal_type: Optional[str] = None
    expires_in_days: Optional[int] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    required_variables: Optional[List[str]] = None
    is_active: Optional[bool] = None


# Admin emails allowed to manage templates
ADMIN_EMAILS = [
    "bensterenson@gmail.com",
    "palarya@gmail.com",
    "dansterenson@gmail.com"
]

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
async def get_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    include_archived: bool = Query(default=False),
    user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get notifications for the current user"""
    try:
        notification_service = get_notification_service()
        user_id = user.firebase_uid
        user_name = user.name or "User"

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        # Sync PULL templates (new template system)
        await notification_service.sync_templates_for_user(user_id, user_name)

        # Also sync legacy feature announcements for backward compatibility
        await notification_service.sync_feature_notifications_for_user(user_id)

        notifications = await notification_service.get_user_notifications(
            user_id=user_id,
            limit=limit,
            include_archived=include_archived
        )

        unread_count = await notification_service.get_unread_count(user_id)

        return {
            "notifications": notifications,
            "unread_count": unread_count,
            "total": len(notifications)
        }

    except Exception as e:
        logger.error(f"Failed to get notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve notifications")


@router.get("/unread-count")
async def get_unread_count(user = Depends(get_current_user)) -> Dict[str, int]:
    """Get unread notification count for the current user"""
    try:
        notification_service = get_notification_service()
        user_id = user.firebase_uid
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        count = await notification_service.get_unread_count(user_id)
        
        return {"unread_count": count}
        
    except Exception as e:
        logger.error(f"Failed to get unread count: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve unread count")


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user = Depends(get_current_user)
) -> Dict[str, bool]:
    """Mark a specific notification as read"""
    try:
        notification_service = get_notification_service()
        user_id = user.firebase_uid
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        success = await notification_service.mark_notification_read(notification_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark notification as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark notification as read")


@router.patch("/mark-all-read")
async def mark_all_notifications_read(
    user = Depends(get_current_user)
) -> Dict[str, int]:
    """Mark all notifications as read for the current user"""
    try:
        notification_service = get_notification_service()
        user_id = user.firebase_uid
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        count = await notification_service.mark_all_notifications_read(user_id)
        
        return {"marked_count": count}
        
    except Exception as e:
        logger.error(f"Failed to mark all notifications as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark all notifications as read")


@router.patch("/{notification_id}/archive")
async def archive_notification(
    notification_id: str,
    user = Depends(get_current_user)
) -> Dict[str, bool]:
    """Archive a specific notification"""
    try:
        notification_service = get_notification_service()
        user_id = user.firebase_uid
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        success = await notification_service.archive_notification(notification_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to archive notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to archive notification")


# ==================== Template Management Endpoints (Admin) ====================

@router.post("/templates")
async def create_notification_template(
    request: CreateNotificationTemplateRequest,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a notification template with configurable distribution.
    Admin only endpoint.

    Distribution types:
    - push: Immediately distribute to targeted users (runs in background)
    - pull: Users receive notification when they fetch notifications (on login)
    - trigger: Notifications created by event handlers (RSU vesting, etc.)

    Targeting options (optional):
    - target_user_ids: List of specific Firebase UIDs to target
    - target_filter: Filter criteria dict with options:
      - has_holding: str - User has a holding with this symbol (e.g., "AAPL")
      - has_account_type: str - User has account of this type (e.g., "401k")
      - has_portfolio: bool - User has at least one portfolio

    If neither targeting option is specified, notification goes to all users.
    """
    if user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Only admins can create notification templates")

    try:
        notification_service = get_notification_service()

        # Validate enums
        try:
            notification_type = NotificationType(request.notification_type)
            distribution_type = DistributionType(request.distribution_type)
            display_type = DisplayType(request.display_type)
            dismissal_type = DismissalType(request.dismissal_type)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid enum value: {e}")

        template = await notification_service.create_template(
            template_id=request.template_id,
            notification_type=notification_type,
            title_template=request.title_template,
            message_template=request.message_template,
            distribution_type=distribution_type,
            display_type=display_type,
            dismissal_type=dismissal_type,
            expires_in_days=request.expires_in_days,
            link_url=request.link_url,
            link_text=request.link_text,
            required_variables=request.required_variables,
            created_by=user.firebase_uid,
            target_user_ids=request.target_user_ids,
            target_filter=request.target_filter
        )

        response = {
            "template_id": template["template_id"],
            "distribution_type": request.distribution_type,
            "available_variables": template.get("available_variables", []),
            "message": "Template created successfully."
        }

        # If PUSH distribution, start background task
        if distribution_type == DistributionType.PUSH:
            background_tasks.add_task(
                notification_service.push_distribute_template,
                request.template_id
            )
            response["push_status"] = "started"
            response["message"] = "Template created. Push distribution started in background."

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create notification template: {e}")
        raise HTTPException(status_code=500, detail="Failed to create notification template")


@router.get("/templates")
async def list_notification_templates(
    include_inactive: bool = Query(default=False),
    user = Depends(get_current_user)
) -> Dict[str, Any]:
    """List all notification templates. Admin only endpoint."""
    if user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Only admins can view notification templates")

    try:
        notification_service = get_notification_service()
        templates = await notification_service.list_templates(include_inactive=include_inactive)

        return {
            "templates": templates,
            "total": len(templates)
        }

    except Exception as e:
        logger.error(f"Failed to list notification templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to list notification templates")


@router.get("/templates/{template_id}")
async def get_notification_template(
    template_id: str,
    user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get a specific notification template. Admin only endpoint."""
    if user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Only admins can view notification templates")

    try:
        notification_service = get_notification_service()
        template = await notification_service.get_template(template_id)

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"template": template}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get notification template: {e}")
        raise HTTPException(status_code=500, detail="Failed to get notification template")


@router.patch("/templates/{template_id}")
async def update_notification_template(
    template_id: str,
    request: UpdateNotificationTemplateRequest,
    user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update a notification template. Admin only endpoint.
    Note: PUSH templates cannot be updated after distribution is complete.
    """
    if user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Only admins can update notification templates")

    try:
        notification_service = get_notification_service()

        # Build updates dict from non-None fields
        updates = {k: v for k, v in request.dict().items() if v is not None}

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        success = await notification_service.update_template(template_id, updates)

        if not success:
            raise HTTPException(status_code=404, detail="Template not found or no changes made")

        return {"success": True, "message": "Template updated successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update notification template: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notification template")


@router.delete("/templates/{template_id}")
async def delete_notification_template(
    template_id: str,
    user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Soft delete a notification template (sets is_active to false).
    Admin only endpoint.
    """
    if user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Only admins can delete notification templates")

    try:
        notification_service = get_notification_service()
        success = await notification_service.deactivate_template(template_id)

        if not success:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"success": True, "message": "Template deactivated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete notification template: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete notification template")


