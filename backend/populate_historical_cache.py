#!/usr/bin/env python3
"""
INFORMATIONAL: Check Historical Cache Status

⚠️ NOTE: This script is for INFORMATION/DEBUGGING only.
The system automatically populates the cache on server startup (T+0) and every 3 hours.

NO MANUAL EXECUTION NEEDED!

The system will:
1. Auto-track symbols when you load portfolio
2. Auto-backfill on server startup (T+0)
3. Auto-backfill every 3 hours via scheduler
4. Auto-backfill missing symbols on each portfolio load (background)

Use this script only to:
- Check which symbols have/need historical data
- Manually force backfill if you're impatient (not recommended)
"""
import asyncio
from datetime import datetime
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db, setup_historical_prices_collection
from services.closing_price.historical_sync import get_sync_service


async def populate_cache():
    """Populate historical cache for all tracked symbols"""
    print("\n" + "="*70)
    print("📊 Populating Historical Cache")
    print("="*70)
    
    try:
        # Connect
        await connect_to_mongo()
        await setup_historical_prices_collection()
        
        # Get all tracked symbols
        all_tracked = await db.database.tracked_symbols.find({}).to_list(length=None)
        print(f"\n✅ Found {len(all_tracked)} symbols in tracked_symbols")
        
        if not all_tracked:
            print("⚠️  No tracked symbols found. Load your portfolio page first to track symbols.")
            return
        
        # Check which symbols have historical data
        symbols_with_history = set()
        async for doc in db.database.historical_prices.find({}, {"symbol": 1}):
            symbols_with_history.add(doc["symbol"])
        
        # Deduplicate symbols_with_history
        symbols_with_history = set(symbols_with_history)
        
        print(f"✅ {len(symbols_with_history)} symbols already have historical data")
        
        # Find symbols that need backfilling
        symbols_needing_backfill = []
        for symbol_doc in all_tracked:
            symbol = symbol_doc["symbol"]
            if symbol not in symbols_with_history:
                symbols_needing_backfill.append(symbol_doc)
        
        print(f"\n📋 {len(symbols_needing_backfill)} symbols need backfilling:")
        for symbol_doc in symbols_needing_backfill:
            print(f"   - {symbol_doc['symbol']} ({symbol_doc.get('market', 'unknown')})")
        
        if not symbols_needing_backfill:
            print("\n🎉 All tracked symbols already have historical data!")
            return
        
        # Ask for confirmation
        print(f"\n⚠️  This will fetch {len(symbols_needing_backfill)} symbols from yfinance")
        print(f"Estimated time: {len(symbols_needing_backfill) * 2 / 60:.1f} minutes")
        print("\nPress Enter to continue, or Ctrl+C to cancel...")
        input()
        
        # Backfill each symbol
        sync_service = get_sync_service()
        success_count = 0
        error_count = 0
        
        print("\n" + "="*70)
        print("Starting backfill...")
        print("="*70)
        
        for i, symbol_doc in enumerate(symbols_needing_backfill, 1):
            symbol = symbol_doc["symbol"]
            market = symbol_doc.get("market", "US")
            
            try:
                print(f"\n[{i}/{len(symbols_needing_backfill)}] Backfilling {symbol}...", end=" ")
                
                result = await sync_service.backfill_new_symbol(symbol, market)
                
                if result["status"] == "success":
                    records = result.get("records_inserted", 0)
                    print(f"✅ {records} records")
                    success_count += 1
                else:
                    print(f"⚠️  {result.get('message', 'Failed')}")
                    error_count += 1
                
                # Small delay to respect API limits
                await asyncio.sleep(0.5)
                
            except Exception as e:
                print(f"❌ Error: {e}")
                error_count += 1
        
        # Summary
        print("\n" + "="*70)
        print("BACKFILL COMPLETE")
        print("="*70)
        print(f"✅ Success: {success_count} symbols")
        print(f"❌ Errors: {error_count} symbols")
        print(f"📊 Total: {len(symbols_needing_backfill)} symbols processed")
        
        # Verify
        total_with_history = len(symbols_with_history) + success_count
        print(f"\n🎉 {total_with_history} symbols now have historical data!")
        
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(populate_cache())

