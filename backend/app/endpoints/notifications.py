"""
Notification API endpoints for managing user notifications.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from core.auth import get_current_user
from core.notification_service import get_notification_service
from models.notification_model import Notification, NotificationStatus
import logging

logger = logging.getLogger(__name__)

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
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
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


@router.post("/welcome")
async def create_welcome_notification(
    user = Depends(get_current_user)
) -> Dict[str, str]:
    """Create a welcome notification for the current user"""
    try:
        notification_service = get_notification_service()
        user_id = user.firebase_uid
        user_name = user.name
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        notification_id = await notification_service.create_welcome_notification(user_id, user_name)
        
        return {"notification_id": notification_id}
        
    except Exception as e:
        logger.error(f"Failed to create welcome notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to create welcome notification")


@router.post("/check-rsu-events")
async def check_rsu_vesting_events(
    user = Depends(get_current_user)
) -> Dict[str, List[str]]:
    """Check for RSU vesting events and create notifications"""
    try:
        notification_service = get_notification_service()
        user_id = user.firebase_uid
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        # This would typically get portfolio data from the portfolio service
        # For now, we'll return an empty list as this should be called internally
        # when portfolio data is processed
        
        return {"notification_ids": []}
        
    except Exception as e:
        logger.error(f"Failed to check RSU vesting events: {e}")
        raise HTTPException(status_code=500, detail="Failed to check RSU vesting events")


