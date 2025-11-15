#!/usr/bin/env python3
import asyncio
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db
from services.closing_price.historical_sync import get_sync_service

async def debug_ibit():
    await connect_to_mongo()
    
    print("="*70)
    print("DEBUG: IBIT Historical Data")
    print("="*70)
    
    # Check tracked_symbols
    tracked = await db.database.tracked_symbols.find_one({'symbol': 'IBIT'})
    print('\n1. Tracked symbol data:')
    if tracked:
        print(f'  Symbol: {tracked.get("symbol")}')
        print(f'  Market: {tracked.get("market")}')
        print(f'  last_update: {tracked.get("last_update")}')
        print(f'  added_at: {tracked.get("added_at")}')
    else:
        print('  NOT FOUND in tracked_symbols!')
    
    # Check historical_prices
    count = await db.database.historical_prices.count_documents({'symbol': 'IBIT'})
    print(f'\n2. Historical records count: {count}')
    
    if count > 0:
        # Get the records
        cursor = db.database.historical_prices.find({'symbol': 'IBIT'}).sort('timestamp', 1)
        records = await cursor.to_list(length=None)
        
        print(f'\n3. All records:')
        for rec in records:
            print(f'  {rec["timestamp"]}: ${rec["close"]}')
    
    # Try to manually backfill
    print('\n4. Attempting manual backfill for IBIT...')
    sync_service = get_sync_service()
    result = await sync_service.backfill_new_symbol('IBIT', market='US')
    
    print(f'\nBackfill result:')
    print(f'  Status: {result.get("status")}')
    print(f'  Records inserted: {result.get("records_inserted", 0)}')
    if result.get('error'):
        print(f'  Error: {result["error"]}')
    
    # Check again
    new_count = await db.database.historical_prices.count_documents({'symbol': 'IBIT'})
    print(f'\n5. After backfill: {new_count} records')
    
    await close_mongo_connection()

asyncio.run(debug_ibit())

