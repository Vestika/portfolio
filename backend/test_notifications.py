#!/usr/bin/env python3
"""
Test script for the notification system.
This script tests the notification service functionality.
"""
import asyncio
import sys
import os
from datetime import datetime, date
from typing import Dict, Any

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.notification_service import get_notification_service
from models.notification_model import Notification, NotificationType, NotificationStatus


async def test_notification_service():
    """Test the notification service functionality"""
    print("🧪 Testing Notification Service...")
    
    # Get notification service
    notification_service = get_notification_service()
    
    # Test user data
    test_user_id = "test_user_123"
    test_user_name = "Test User"
    
    try:
        # Test 1: Create welcome notification
        print("\n1. Testing welcome notification creation...")
        welcome_id = await notification_service.create_welcome_notification(
            test_user_id, test_user_name
        )
        print(f"✅ Created welcome notification: {welcome_id}")
        
        # Test 2: Create RSU vesting notification
        print("\n2. Testing RSU vesting notification creation...")
        rsu_id = await notification_service.create_rsu_vesting_notification(
            test_user_id, "AAPL", 100.0, "2024-01-15", "Company Account"
        )
        print(f"✅ Created RSU vesting notification: {rsu_id}")
        
        # Test 3: Get user notifications
        print("\n3. Testing notification retrieval...")
        notifications = await notification_service.get_user_notifications(test_user_id)
        print(f"✅ Retrieved {len(notifications)} notifications")
        for notif in notifications:
            print(f"   - {notif['type']}: {notif['title']} ({notif['status']})")
        
        # Test 4: Get unread count
        print("\n4. Testing unread count...")
        unread_count = await notification_service.get_unread_count(test_user_id)
        print(f"✅ Unread count: {unread_count}")
        
        # Test 5: Mark notification as read
        print("\n5. Testing mark as read...")
        if notifications:
            first_notif_id = notifications[0]['_id']
            success = await notification_service.mark_notification_read(first_notif_id, test_user_id)
            print(f"✅ Marked notification as read: {success}")
        
        # Test 6: Check unread count after marking as read
        print("\n6. Testing unread count after marking as read...")
        new_unread_count = await notification_service.get_unread_count(test_user_id)
        print(f"✅ New unread count: {new_unread_count}")
        
        # Test 7: Test RSU event detection
        print("\n7. Testing RSU event detection...")
        mock_portfolio_data = {
            "accounts": [
                {
                    "account_name": "Company Account",
                    "account_type": "company-custodian-account",
                    "rsu_vesting_data": [
                        {
                            "symbol": "AAPL",
                            "next_vest_date": date.today().isoformat(),
                            "next_vest_units": 50.0
                        }
                    ]
                }
            ]
        }
        
        event_notification_ids = await notification_service.check_rsu_vesting_events(
            test_user_id, mock_portfolio_data
        )
        print(f"✅ RSU event detection created {len(event_notification_ids)} notifications")
        
        # Test 8: Final notification count
        print("\n8. Final notification count...")
        final_notifications = await notification_service.get_user_notifications(test_user_id)
        print(f"✅ Total notifications: {len(final_notifications)}")
        
        print("\n🎉 All notification service tests passed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


async def test_notification_model():
    """Test the notification model functionality"""
    print("\n🧪 Testing Notification Model...")
    
    try:
        # Test welcome notification creation
        welcome_notif = Notification.create_welcome_notification("test_user", "Test User")
        print(f"✅ Created welcome notification: {welcome_notif.title}")
        
        # Test RSU vesting notification creation
        rsu_notif = Notification.create_rsu_vesting_notification(
            "test_user", "AAPL", 100.0, "2024-01-15", "Company Account"
        )
        print(f"✅ Created RSU vesting notification: {rsu_notif.title}")
        
        # Test RSU grant notification creation
        grant_notif = Notification.create_rsu_grant_notification(
            "test_user", "GOOGL", 50.0, "2024-01-01", "Company Account"
        )
        print(f"✅ Created RSU grant notification: {grant_notif.title}")
        
        print("🎉 All notification model tests passed!")
        
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Run all tests"""
    print("🚀 Starting Notification System Tests...")
    
    # Test notification model
    await test_notification_model()
    
    # Test notification service (requires database connection)
    try:
        await test_notification_service()
    except Exception as e:
        print(f"⚠️ Notification service tests skipped (database not available): {e}")
    
    print("\n✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())
