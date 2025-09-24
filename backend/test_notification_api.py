#!/usr/bin/env python3
"""
Test script to verify the notification API endpoints are working correctly.
"""
import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.database import db_manager
from core.notification_service import get_notification_service
from models.notification_model import NotificationType
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_notification_api():
    """Test the notification API functionality"""
    try:
        # Connect to database
        await db_manager.connect("vestika")
        logger.info("✅ Connected to database")
        
        # Get a user from the database
        users_collection = db_manager.get_collection("users")
        users = await users_collection.find({}).to_list(1)
        
        if not users:
            logger.error("❌ No users found in database")
            return
        
        user_doc = users[0]
        user_id = user_doc.get("firebase_uid")
        user_name = user_doc.get("name", "Test User")
        
        if not user_id:
            logger.error("❌ User has no firebase_uid")
            return
        
        logger.info(f"🧪 Testing with user: {user_name} ({user_id})")
        
        # Test notification service
        notification_service = get_notification_service()
        
        # Test 1: Get user notifications
        logger.info("📝 Test 1: Getting user notifications...")
        notifications = await notification_service.get_user_notifications(user_id)
        logger.info(f"✅ Found {len(notifications)} notifications")
        
        for notif in notifications:
            logger.info(f"  - {notif['type']}: {notif['title']} ({notif['status']})")
        
        # Test 2: Get unread count
        logger.info("📝 Test 2: Getting unread count...")
        unread_count = await notification_service.get_unread_count(user_id)
        logger.info(f"✅ Unread count: {unread_count}")
        
        # Test 3: Check if welcome notification exists
        logger.info("📝 Test 3: Checking for welcome notification...")
        collection = notification_service._get_collection()
        welcome_notif = await collection.find_one({
            "user_id": user_id,
            "type": NotificationType.WELCOME
        })
        
        if welcome_notif:
            logger.info(f"✅ Welcome notification found: {welcome_notif['title']}")
        else:
            logger.warning("⚠️ No welcome notification found")
        
        logger.info("🎉 All tests completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_notification_api())
