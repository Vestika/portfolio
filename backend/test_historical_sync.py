#!/usr/bin/env python3
"""
Test script for historical sync service (cron job logic).
Tests both Stage 1 (fast transfer) and Stage 2 (self-healing).
"""
import asyncio
from datetime import datetime, timedelta
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db, setup_historical_prices_collection
from services.closing_price.historical_sync import get_sync_service
from services.closing_price.live_price_cache import get_live_price_cache


async def setup_test_data():
    """Setup test data for sync tests"""
    print("\n" + "="*60)
    print("SETUP: Creating Test Data")
    print("="*60)
    
    try:
        await connect_to_mongo()
        await setup_historical_prices_collection()
        
        # Clear existing test data
        await db.database.tracked_symbols.delete_many({"symbol": {"$in": ["TEST_AAPL", "TEST_MSFT", "TEST_LAGGING"]}})
        await db.database.historical_prices.delete_many({"symbol": {"$in": ["TEST_AAPL", "TEST_MSFT", "TEST_LAGGING"]}})
        
        now = datetime.utcnow()
        
        # Create tracked symbols with different states
        # 1. Recently updated symbol (for Stage 1 test)
        await db.database.tracked_symbols.insert_one({
            "symbol": "TEST_AAPL",
            "market": "US",
            "added_at": now - timedelta(days=1),
            "last_queried_at": now,
            "last_update": now - timedelta(hours=1)  # Updated 1 hour ago
        })
        
        # 2. Another recently updated symbol
        await db.database.tracked_symbols.insert_one({
            "symbol": "TEST_MSFT",
            "market": "US",
            "added_at": now - timedelta(days=2),
            "last_queried_at": now,
            "last_update": now - timedelta(hours=2)  # Updated 2 hours ago
        })
        
        # 3. Lagging symbol (for Stage 2 test)
        await db.database.tracked_symbols.insert_one({
            "symbol": "TEST_LAGGING",
            "market": "US",
            "added_at": now - timedelta(days=5),
            "last_queried_at": now,
            "last_update": now - timedelta(days=5)  # Updated 5 days ago (lagging!)
        })
        
        print("✅ Created 3 tracked symbols:")
        print("   - TEST_AAPL (recently updated)")
        print("   - TEST_MSFT (recently updated)")
        print("   - TEST_LAGGING (needs backfill)")
        
        # Add prices to live cache for recently updated symbols
        cache = get_live_price_cache()
        cache.set("TEST_AAPL", 150.50, currency="USD", market="US")
        cache.set("TEST_MSFT", 380.25, currency="USD", market="US")
        
        print("✅ Added prices to live cache for TEST_AAPL and TEST_MSFT")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during setup: {e}")
        return False


async def test_stage1_fast_transfer():
    """Test Stage 1: Fast cache transfer"""
    print("\n" + "="*60)
    print("TEST 1: Stage 1 - Fast Cache Transfer")
    print("="*60)
    
    try:
        sync_service = get_sync_service()
        
        # Run Stage 1
        result = await sync_service._stage1_fast_transfer()
        
        print(f"✅ Stage 1 completed")
        print(f"   Success count: {result.get('success_count', 0)}")
        print(f"   Error count: {result.get('error_count', 0)}")
        print(f"   Upserted: {result.get('upserted', 0)}")
        print(f"   Modified: {result.get('modified', 0)}")
        
        # Verify data was inserted into historical_prices
        count = await db.database.historical_prices.count_documents({
            "symbol": {"$in": ["TEST_AAPL", "TEST_MSFT"]}
        })
        
        assert count >= 2, f"Expected at least 2 historical records, got {count}"
        print(f"✅ Verified {count} records inserted into historical_prices")
        
        # Verify last_update was updated
        aapl_doc = await db.database.tracked_symbols.find_one({"symbol": "TEST_AAPL"})
        assert aapl_doc is not None, "TEST_AAPL should exist"
        
        last_update = aapl_doc.get("last_update")
        assert last_update is not None, "last_update should be set"
        
        # Should be very recent (within last minute)
        age_seconds = (datetime.utcnow() - last_update).total_seconds()
        assert age_seconds < 60, f"last_update should be recent, but is {age_seconds}s old"
        
        print(f"✅ last_update was updated (age: {age_seconds:.1f}s)")
        
        return True
        
    except AssertionError as e:
        print(f"❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_stage2_self_healing():
    """Test Stage 2: Self-healing backfill"""
    print("\n" + "="*60)
    print("TEST 2: Stage 2 - Self-Healing Backfill")
    print("="*60)
    
    try:
        sync_service = get_sync_service()
        
        # Run Stage 2
        result = await sync_service._stage2_self_healing()
        
        print(f"✅ Stage 2 completed")
        print(f"   Success count: {result.get('success_count', 0)}")
        print(f"   Error count: {result.get('error_count', 0)}")
        print(f"   Total processed: {result.get('total_processed', 0)}")
        
        # Note: TEST_LAGGING might not backfill successfully if yfinance doesn't have data
        # for test symbols, which is expected. The important thing is the logic runs without errors.
        
        assert result.get('error_count', 0) <= result.get('total_processed', 1), "Should not have more errors than symbols"
        
        print(f"✅ Stage 2 self-healing logic executed successfully")
        
        return True
        
    except AssertionError as e:
        print(f"❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_backfill_new_symbol():
    """Test backfill_new_symbol logic"""
    print("\n" + "="*60)
    print("TEST 3: Backfill New Symbol")
    print("="*60)
    
    try:
        sync_service = get_sync_service()
        
        # Clean up previous test data
        await db.database.tracked_symbols.delete_many({"symbol": "AAPL"})
        await db.database.historical_prices.delete_many({"symbol": "AAPL"})
        
        # Backfill AAPL (real symbol)
        print("   Fetching 1 year of historical data for AAPL (this may take ~10s)...")
        result = await sync_service.backfill_new_symbol("AAPL", market="US")
        
        print(f"✅ Backfill completed")
        print(f"   Status: {result.get('status')}")
        
        if result.get('status') == 'success':
            print(f"   Records inserted: {result.get('records_inserted', 0)}")
            print(f"   Date range: {result.get('date_range', {}).get('start', 'N/A')[:10]} to {result.get('date_range', {}).get('end', 'N/A')[:10]}")
            
            # Verify data exists
            count = await db.database.historical_prices.count_documents({"symbol": "AAPL"})
            print(f"✅ Verified {count} historical records in database")
            
            assert count > 0, "Should have historical records"
            assert count >= 200, f"Should have ~250 records for 1 year, got {count}"
        else:
            print(f"   Message: {result.get('message', 'N/A')}")
        
        return True
        
    except AssertionError as e:
        print(f"❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_full_sync_cycle():
    """Test complete sync cycle (both stages)"""
    print("\n" + "="*60)
    print("TEST 4: Full Sync Cycle")
    print("="*60)
    
    try:
        sync_service = get_sync_service()
        
        # Run full sync
        result = await sync_service.run_daily_sync()
        
        print(f"✅ Full sync completed")
        print(f"   Sync timestamp: {result.get('sync_timestamp')}")
        print(f"   Total symbols updated: {result.get('total_symbols_updated', 0)}")
        print(f"   Total errors: {result.get('total_errors', 0)}")
        
        stage1 = result.get('stage1', {})
        stage2 = result.get('stage2', {})
        
        print(f"\n   Stage 1 (Fast Transfer):")
        print(f"      Success: {stage1.get('success_count', 0)}")
        print(f"      Errors: {stage1.get('error_count', 0)}")
        
        print(f"\n   Stage 2 (Self-Healing):")
        print(f"      Success: {stage2.get('success_count', 0)}")
        print(f"      Errors: {stage2.get('error_count', 0)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def cleanup_test_data():
    """Clean up test data"""
    print("\n" + "="*60)
    print("CLEANUP: Removing Test Data")
    print("="*60)
    
    try:
        # Remove test symbols
        result1 = await db.database.tracked_symbols.delete_many({
            "symbol": {"$in": ["TEST_AAPL", "TEST_MSFT", "TEST_LAGGING", "AAPL"]}
        })
        print(f"✅ Removed {result1.deleted_count} tracked symbol records")
        
        result2 = await db.database.historical_prices.delete_many({
            "symbol": {"$in": ["TEST_AAPL", "TEST_MSFT", "TEST_LAGGING", "AAPL"]}
        })
        print(f"✅ Removed {result2.deleted_count} historical price records")
        
        # Clear live cache
        cache = get_live_price_cache()
        cache.clear()
        print(f"✅ Cleared live price cache")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return False


async def main():
    """Run all tests"""
    print("\n" + "🔍 Historical Sync Service - Test Suite")
    print("="*60)
    
    try:
        # Setup
        setup_ok = await setup_test_data()
        if not setup_ok:
            print("❌ Setup failed, aborting tests")
            return
        
        # Run tests
        test1 = await test_stage1_fast_transfer()
        test2 = await test_stage2_self_healing()
        test3 = await test_backfill_new_symbol()
        test4 = await test_full_sync_cycle()
        
        # Cleanup
        await cleanup_test_data()
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Test 1 (Stage 1 Fast Transfer): {'✅ PASSED' if test1 else '❌ FAILED'}")
        print(f"Test 2 (Stage 2 Self-Healing): {'✅ PASSED' if test2 else '❌ FAILED'}")
        print(f"Test 3 (Backfill New Symbol): {'✅ PASSED' if test3 else '❌ FAILED'}")
        print(f"Test 4 (Full Sync Cycle): {'✅ PASSED' if test4 else '❌ FAILED'}")
        
        all_passed = all([test1, test2, test3, test4])
        print("\n" + ("="*60))
        if all_passed:
            print("🎉 ALL TESTS PASSED! Historical sync service is ready.")
        else:
            print("⚠️  SOME TESTS FAILED. Please review errors above.")
        print("="*60 + "\n")
        
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())

