#!/usr/bin/env python3
import asyncio
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db
from services.closing_price.historical_sync import get_sync_service

async def debug_tase():
    await connect_to_mongo()
    
    print("="*70)
    print("DEBUG: TASE Symbol 629014 (Teva)")
    print("="*70)
    
    # Check current state
    count = await db.database.historical_prices.count_documents({'symbol': '629014'})
    print(f'\n1. Current historical records: {count}')
    
    # Try to backfill
    print('\n2. Attempting backfill with pymaya...')
    sync_service = get_sync_service()
    result = await sync_service.backfill_new_symbol('629014', market='TASE')
    
    print(f'\nBackfill result:')
    print(f'  Status: {result.get("status")}')
    print(f'  Records inserted: {result.get("records_inserted", 0)}')
    if result.get('error'):
        print(f'  Error: {result["error"]}')
    
    # Check final count
    final_count = await db.database.historical_prices.count_documents({'symbol': '629014'})
    print(f'\n3. After backfill: {final_count} records')
    
    if final_count > 0:
        # Show sample
        cursor = db.database.historical_prices.find({'symbol': '629014'}).sort('timestamp', -1).limit(5)
        records = await cursor.to_list(length=5)
        print('\n4. Sample records (most recent):')
        for rec in records:
            print(f'  {rec["timestamp"].strftime("%Y-%m-%d")}: ₪{rec["close"]:.2f}')
    
    await close_mongo_connection()

asyncio.run(debug_tase())

