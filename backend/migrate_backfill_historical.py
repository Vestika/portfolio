#!/usr/bin/env python3
"""
OPTIONAL Migration: Backfill Historical Prices

⚠️ NOTE: This script is OPTIONAL. The system will automatically backfill existing
symbols through the scheduled sync job (Stage 2: Self-Healing) that runs every 3 hours.

Use this script only if you want to:
- Backfill all symbols immediately instead of waiting for scheduled sync
- Fetch more than 7 days of history (scheduler only backfills gaps)

The system automatically handles existing symbols via:
1. Startup: Initial sync runs 10 seconds after app start
2. Scheduled: Cron job every 3 hours catches symbols without last_update
3. Self-healing: Stage 2 automatically backfills any symbol missing historical data

Usage:
    poetry run python migrate_backfill_historical.py

Options:
    --days N     Number of days of history to fetch (default: 365)
    --dry-run    Show what would be done without actually doing it
"""
import asyncio
import argparse
from datetime import datetime
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db, setup_historical_prices_collection
from services.closing_price.historical_sync import get_sync_service


async def run_migration(days: int = 365, dry_run: bool = False):
    """
    Run the one-time migration to backfill historical data.
    
    Args:
        days: Number of days of history to fetch
        dry_run: If True, show what would be done without doing it
    """
    print("\n" + "="*70)
    print("📊 ONE-TIME MIGRATION: Backfill Historical Prices")
    print("="*70)
    print(f"Date: {datetime.utcnow().isoformat()}")
    print(f"History window: {days} days")
    print(f"Dry run: {'YES (no changes will be made)' if dry_run else 'NO (will modify database)'}")
    print("="*70)
    
    try:
        # Connect to database
        print("\n1️⃣ Connecting to MongoDB...")
        await connect_to_mongo()
        print("   ✅ Connected to MongoDB")
        
        # Setup time-series collection
        print("\n2️⃣ Setting up time-series collection...")
        await setup_historical_prices_collection()
        print("   ✅ Time-series collection ready")
        
        # Count existing symbols
        print("\n3️⃣ Analyzing existing symbols...")
        all_symbols = await db.database.tracked_symbols.find({}).to_list(length=None)
        print(f"   ✅ Found {len(all_symbols)} tracked symbols")
        
        if not all_symbols:
            print("\n⚠️  No tracked symbols found. Nothing to migrate.")
            return
        
        # Show breakdown by market
        markets = {}
        for symbol_doc in all_symbols:
            market = symbol_doc.get("market", "unknown")
            markets[market] = markets.get(market, 0) + 1
        
        print("\n   Market breakdown:")
        for market, count in markets.items():
            print(f"      {market}: {count} symbols")
        
        # Check which symbols already have historical data
        print("\n4️⃣ Checking existing historical data...")
        symbols_with_history = set()
        
        pipeline = [
            {"$group": {"_id": "$symbol"}},
        ]
        result = await db.database.historical_prices.aggregate(pipeline).to_list(length=None)
        symbols_with_history = {doc["_id"] for doc in result}
        
        symbols_needing_backfill = [s for s in all_symbols if s["symbol"] not in symbols_with_history]
        
        print(f"   ✅ {len(symbols_with_history)} symbols already have historical data")
        print(f"   ✅ {len(symbols_needing_backfill)} symbols need backfilling")
        
        if dry_run:
            print("\n" + "="*70)
            print("DRY RUN MODE - No changes will be made")
            print("="*70)
            print(f"\nWould backfill {len(symbols_needing_backfill)} symbols:")
            for symbol_doc in symbols_needing_backfill[:10]:  # Show first 10
                print(f"   - {symbol_doc['symbol']} ({symbol_doc.get('market', 'unknown')})")
            if len(symbols_needing_backfill) > 10:
                print(f"   ... and {len(symbols_needing_backfill) - 10} more")
            print("\nTo actually run the migration, remove the --dry-run flag")
            return
        
        # Confirm before proceeding
        print("\n" + "="*70)
        print("⚠️  WARNING: This will fetch historical data from yfinance")
        print("="*70)
        print(f"Symbols to backfill: {len(symbols_needing_backfill)}")
        print(f"Estimated time: {len(symbols_needing_backfill) * 2 / 60:.1f} minutes")
        print("\nThis may take a while. The process will:")
        print("  - Fetch 1 year of historical data for each symbol")
        print("  - Store it in MongoDB time-series collection")
        print("  - Add rate limiting to respect API limits")
        print("\nPress Ctrl+C to cancel within 5 seconds...")
        
        try:
            await asyncio.sleep(5)
        except KeyboardInterrupt:
            print("\n❌ Migration cancelled by user")
            return
        
        # Run the migration
        print("\n5️⃣ Starting backfill process...")
        print("="*70)
        
        sync_service = get_sync_service()
        result = await sync_service.backfill_existing_symbols(days)
        
        # Display results
        print("\n" + "="*70)
        print("📊 MIGRATION RESULTS")
        print("="*70)
        print(f"Status: {result.get('status', 'unknown')}")
        print(f"Total symbols processed: {result.get('total_symbols', 0)}")
        print(f"✅ Success: {result.get('success_count', 0)}")
        print(f"⏭️  Skipped (already have data): {result.get('skipped_count', 0)}")
        print(f"❌ Errors: {result.get('error_count', 0)}")
        
        if result.get('error'):
            print(f"\nError details: {result['error']}")
        
        print("="*70)
        
        if result.get('status') == 'completed':
            print("\n🎉 Migration completed successfully!")
            print("\nNext steps:")
            print("  1. Check /cache/status endpoint to verify data")
            print("  2. Test portfolio page load performance")
            print("  3. Monitor scheduler jobs with /cache/scheduler/status")
        else:
            print("\n⚠️  Migration completed with errors. Check logs for details.")
        
    except KeyboardInterrupt:
        print("\n\n❌ Migration cancelled by user")
    except Exception as e:
        print(f"\n\n❌ Migration failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await close_mongo_connection()


def main():
    """Parse arguments and run migration"""
    parser = argparse.ArgumentParser(
        description="Backfill historical prices for existing symbols"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=365,
        help="Number of days of history to fetch (default: 365)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without actually doing it"
    )
    
    args = parser.parse_args()
    
    asyncio.run(run_migration(days=args.days, dry_run=args.dry_run))


if __name__ == "__main__":
    main()

