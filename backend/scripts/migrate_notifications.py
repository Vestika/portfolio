"""
Migration script to convert feature_announcements to notification_templates.

This script:
1. Reads all documents from the feature_announcements collection
2. Converts them to the new notification_templates format
3. Inserts them into the notification_templates collection (if not exists)

Usage:
    cd backend
    poetry run python scripts/migrate_notifications.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()


async def migrate_feature_announcements():
    """Migrate feature_announcements to notification_templates"""
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    database_name = os.getenv("MONGODB_DATABASE", "vestika")

    client = AsyncIOMotorClient(mongodb_url)
    db = client[database_name]

    old_collection = db["feature_announcements"]
    new_collection = db["notification_templates"]

    # Get all feature announcements
    announcements = await old_collection.find({}).to_list(length=None)
    print(f"Found {len(announcements)} feature announcements to migrate")

    migrated_count = 0
    skipped_count = 0

    for announcement in announcements:
        template_id = announcement.get("feature_id")
        if not template_id:
            print(f"Skipping announcement without feature_id: {announcement.get('_id')}")
            skipped_count += 1
            continue

        # Check if template already exists
        existing = await new_collection.find_one({"template_id": template_id})
        if existing:
            print(f"Template '{template_id}' already exists, skipping")
            skipped_count += 1
            continue

        # Convert to new template format
        template = {
            "template_id": template_id,
            "notification_type": "feature",
            "title_template": announcement.get("title", ""),
            "message_template": announcement.get("message", ""),
            "available_variables": [],  # Legacy announcements had no variables
            "required_variables": [],
            "distribution_type": "pull",  # Legacy behavior was pull on login
            "display_type": announcement.get("display_type", "both"),
            "dismissal_type": announcement.get("dismissal_type", "once"),
            "expires_in_days": None,
            "link_url": announcement.get("link_url"),
            "link_text": announcement.get("link_text", "Check it out"),
            "is_active": True,
            "created_at": announcement.get("created_at", datetime.utcnow()),
            "created_by": None,  # Legacy - no creator tracking
            "push_completed_at": None,
            "push_user_count": None,
            "_migrated_from": "feature_announcements",
            "_original_id": str(announcement["_id"])
        }

        # Handle expires_at if it exists
        if announcement.get("expires_at"):
            # Convert to expires_in_days from now if still in future
            expires_at = announcement["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at > datetime.utcnow():
                days_remaining = (expires_at - datetime.utcnow()).days
                template["expires_in_days"] = max(1, days_remaining)

        await new_collection.insert_one(template)
        print(f"Migrated template: {template_id}")
        migrated_count += 1

    print(f"\nMigration complete:")
    print(f"  - Migrated: {migrated_count}")
    print(f"  - Skipped: {skipped_count}")
    print(f"  - Total processed: {len(announcements)}")

    # Don't delete old collection - keep for safety
    print("\nNote: The feature_announcements collection was NOT deleted.")
    print("You can drop it manually after verifying the migration:")
    print(f"  db.feature_announcements.drop()")

    client.close()


if __name__ == "__main__":
    asyncio.run(migrate_feature_announcements())
