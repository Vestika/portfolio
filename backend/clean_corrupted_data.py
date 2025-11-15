#!/usr/bin/env python3
"""
Clean Corrupted Historical Data

The recent data (last 5 days) was corrupted by Stage 1 using wrong values
from the live cache. This script removes the corrupted records so Stage 2
can backfill them correctly.
"""
import asyncio
from datetime import datetime, timedelta
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db

async def clean_corrupted_data():
    await connect_to_mongo()
    
    print("="*70)
    print("Cleaning Corrupted Historical Data")
    print("="*70)
    
    # Delete recent data (last 7 days) which may be corrupted
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    print(f"\nDeleting records newer than: {seven_days_ago}")
    print("(These will be backfilled correctly by Stage 2)")
    
    result = await db.database.historical_prices.delete_many({
        "timestamp": {"$gte": seven_days_ago}
    })
    
    print(f"\n✅ Deleted {result.deleted_count} potentially corrupted records")
    
    # Also reset last_update for all symbols to trigger full backfill
    print("\nResetting last_update for all symbols...")
    result2 = await db.database.tracked_symbols.update_many(
        {},
        {"$unset": {"last_update": ""}}
    )
    
    print(f"✅ Reset last_update for {result2.modified_count} symbols")
    
    print("\n" + "="*70)
    print("Cleanup Complete!")
    print("="*70)
    print("\nNext steps:")
    print("1. Restart server")
    print("2. T+0 sync will backfill all symbols correctly")
    print("3. All historical data will be accurate")
    
    await close_mongo_connection()

asyncio.run(clean_corrupted_data())

