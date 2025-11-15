#!/usr/bin/env python3
import asyncio
from datetime import datetime, timedelta
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db

async def check():
    await connect_to_mongo()
    
    # Check AAPL
    cursor = db.database.historical_prices.find({'symbol': 'AAPL'}).sort('timestamp', 1)
    records = await cursor.to_list(length=None)
    
    if records:
        print(f'AAPL total records: {len(records)}')
        print(f'Oldest: {records[0]["timestamp"]}')
        print(f'Newest: {records[-1]["timestamp"]}')
        
        # Check 7-day range
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        print(f'\n7-day cutoff: {seven_days_ago}')
        
        recent = [r for r in records if r['timestamp'] >= seven_days_ago]
        print(f'Records in last 7 days: {len(recent)}')
        
        if recent:
            print(f'\nDates in last 7 days:')
            for r in recent[-10:]:  # Last 10
                print(f'  {r["timestamp"]}: ${r["close"]}')
    
    await close_mongo_connection()

asyncio.run(check())

