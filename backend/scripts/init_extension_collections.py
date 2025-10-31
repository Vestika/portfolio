"""
Initialize MongoDB collections and indexes for extension features.

This script creates the required collections and indexes for:
- shared_configs: Community-created extraction configurations
- private_configs: User-specific auto-sync mappings
- extraction_sessions: Temporary extraction sessions (with TTL)
"""

import asyncio
import os
import sys
from pymongo import IndexModel, ASCENDING, DESCENDING

# Add parent directory to path to import from backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import db_manager


async def create_indexes():
    """Create indexes for all extension-related collections"""
    db = await db_manager.get_database("vestika")

    print("Creating indexes for extension collections...")

    # ========================================================================
    # shared_configs collection
    # ========================================================================
    print("\n1. Creating indexes for 'shared_configs'...")

    shared_configs_indexes = [
        IndexModel([("url_pattern", ASCENDING)], name="url_pattern_1"),
        IndexModel([("creator_id", ASCENDING)], name="creator_id_1"),
        IndexModel([("status", ASCENDING), ("is_public", ASCENDING)], name="status_1_is_public_1"),
        IndexModel([("success_rate", DESCENDING)], name="success_rate_-1"),
        IndexModel([("config_id", ASCENDING)], name="config_id_1", unique=True, sparse=True),
    ]

    try:
        await db.shared_configs.create_indexes(shared_configs_indexes)
        print("   ✓ Created indexes for 'shared_configs'")
    except Exception as e:
        print(f"   ✗ Error creating indexes for 'shared_configs': {e}")

    # ========================================================================
    # private_configs collection
    # ========================================================================
    print("\n2. Creating indexes for 'private_configs'...")

    private_configs_indexes = [
        IndexModel([("user_id", ASCENDING)], name="user_id_1"),
        IndexModel(
            [("user_id", ASCENDING), ("shared_config_id", ASCENDING)],
            name="user_id_1_shared_config_id_1",
            unique=True
        ),
        IndexModel([("enabled", ASCENDING)], name="enabled_1"),
    ]

    try:
        await db.private_configs.create_indexes(private_configs_indexes)
        print("   ✓ Created indexes for 'private_configs'")
    except Exception as e:
        print(f"   ✗ Error creating indexes for 'private_configs': {e}")

    # ========================================================================
    # extraction_sessions collection (enhance existing)
    # ========================================================================
    print("\n3. Creating/updating indexes for 'extraction_sessions'...")

    extraction_sessions_indexes = [
        IndexModel([("user_id", ASCENDING)], name="user_id_1"),
        IndexModel([("status", ASCENDING)], name="status_1"),
        IndexModel([("created_at", ASCENDING)], name="created_at_1", expireAfterSeconds=86400),  # TTL: 24 hours
    ]

    try:
        await db.extraction_sessions.create_indexes(extraction_sessions_indexes)
        print("   ✓ Created indexes for 'extraction_sessions'")
    except Exception as e:
        print(f"   ✗ Error creating indexes for 'extraction_sessions': {e}")

    print("\n✅ Index creation complete!")
    print("\nYou can verify indexes with:")
    print("  db.shared_configs.getIndexes()")
    print("  db.private_configs.getIndexes()")
    print("  db.extraction_sessions.getIndexes()")


async def main():
    """Main entry point"""
    try:
        await create_indexes()
    finally:
        await db_manager.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
