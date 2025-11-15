#!/usr/bin/env python3
"""
Test script for live price updater service.
Tests the background service that updates the cache every 15 minutes.
"""
import asyncio
from datetime import datetime, timedelta
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db
from services.closing_price.live_price_updater import get_updater_service
from services.closing_price.live_price_cache import get_live_price_cache


async def setup_test_symbols():
    """Setup test symbols in tracked_symbols"""
    print("\n" + "="*60)
    print("SETUP: Creating Test Symbols")
    print("="*60)
    
    try:
        await connect_to_mongo()
        
        # Clear existing test data
        await db.database.tracked_symbols.delete_many({"symbol": {"$in": ["AAPL", "MSFT", "GOOG"]}})
        
        now = datetime.utcnow()
        
        # Insert real symbols for testing
        test_symbols = [
            {"symbol": "AAPL", "market": "US", "added_at": now, "last_queried_at": now, "last_update": now},
            {"symbol": "MSFT", "market": "US", "added_at": now, "last_queried_at": now, "last_update": now},
            {"symbol": "GOOG", "market": "US", "added_at": now, "last_queried_at": now, "last_update": now},
        ]
        
        await db.database.tracked_symbols.insert_many(test_symbols)
        print(f"✅ Created {len(test_symbols)} test symbols in tracked_symbols")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during setup: {e}")
        return False


async def test_single_update_cycle():
    """Test a single update cycle"""
    print("\n" + "="*60)
    print("TEST 1: Single Update Cycle")
    print("="*60)
    
    try:
        updater = get_updater_service()
        cache = get_live_price_cache()
        
        # Clear cache first
        cache.clear()
        initial_size = cache.size()
        assert initial_size == 0, "Cache should be empty"
        print(f"✅ Cache cleared (size: {initial_size})")
        
        # Run single update
        print("   Fetching live prices for tracked symbols...")
        result = await updater.update_once()
        
        print(f"✅ Update completed")
        print(f"   Updated: {result.get('updated', 0)}")
        print(f"   Errors: {result.get('errors', 0)}")
        print(f"   Timestamp: {result.get('timestamp')}")
        
        # Verify cache is populated
        final_size = cache.size()
        print(f"✅ Cache now has {final_size} symbols")
        
        # Check if specific symbols were updated
        for symbol in ["AAPL", "MSFT", "GOOG"]:
            price_data = cache.get(symbol)
            if price_data:
                print(f"   {symbol}: ${price_data['price']:.2f} (updated: {price_data['last_update'].strftime('%H:%M:%S')})")
        
        assert final_size > 0, "Cache should have symbols after update"
        
        return True
        
    except AssertionError as e:
        print(f"❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_background_service():
    """Test background service start/stop"""
    print("\n" + "="*60)
    print("TEST 2: Background Service Start/Stop")
    print("="*60)
    
    try:
        updater = get_updater_service()
        
        # Start service
        await updater.start()
        print("✅ Background service started")
        
        # Wait a few seconds
        print("   Waiting 3 seconds...")
        await asyncio.sleep(3)
        
        # Check cache stats
        cache = get_live_price_cache()
        stats = cache.get_stats()
        print(f"✅ Cache stats: {stats}")
        
        # Stop service
        await updater.stop()
        print("✅ Background service stopped")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_cache_stats():
    """Test cache statistics"""
    print("\n" + "="*60)
    print("TEST 3: Cache Statistics")
    print("="*60)
    
    try:
        cache = get_live_price_cache()
        
        # Get stats
        stats = cache.get_stats()
        
        print(f"✅ Cache statistics:")
        print(f"   Total symbols: {stats['total_symbols']}")
        print(f"   Markets: {stats['markets']}")
        print(f"   Oldest update: {stats['oldest_update']}")
        print(f"   Newest update: {stats['newest_update']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


async def cleanup_test_data():
    """Clean up test data"""
    print("\n" + "="*60)
    print("CLEANUP: Removing Test Data")
    print("="*60)
    
    try:
        # Remove test symbols
        result = await db.database.tracked_symbols.delete_many({
            "symbol": {"$in": ["AAPL", "MSFT", "GOOG"]}
        })
        print(f"✅ Removed {result.deleted_count} test symbols")
        
        # Clear cache
        cache = get_live_price_cache()
        cache.clear()
        print(f"✅ Cleared live price cache")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return False


async def main():
    """Run all tests"""
    print("\n" + "🔍 Live Price Updater Service - Test Suite")
    print("="*60)
    
    try:
        # Setup
        setup_ok = await setup_test_symbols()
        if not setup_ok:
            print("❌ Setup failed, aborting tests")
            return
        
        # Run tests
        test1 = await test_single_update_cycle()
        test2 = await test_background_service()
        test3 = await test_cache_stats()
        
        # Cleanup
        await cleanup_test_data()
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Test 1 (Single Update Cycle): {'✅ PASSED' if test1 else '❌ FAILED'}")
        print(f"Test 2 (Background Service): {'✅ PASSED' if test2 else '❌ FAILED'}")
        print(f"Test 3 (Cache Statistics): {'✅ PASSED' if test3 else '❌ FAILED'}")
        
        all_passed = all([test1, test2, test3])
        print("\n" + ("="*60))
        if all_passed:
            print("🎉 ALL TESTS PASSED! Live updater service is ready.")
        else:
            print("⚠️  SOME TESTS FAILED. Please review errors above.")
        print("="*60 + "\n")
        
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())

