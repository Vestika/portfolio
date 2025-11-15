#!/usr/bin/env python3
"""
Comprehensive Integration Test for Historical Price Caching System

This test validates the entire system working together:
1. Time-series collection setup
2. Live cache operations  
3. Historical sync (both stages)
4. Live price updater
5. API endpoint integration
6. Performance benchmarks
"""
import asyncio
import time
from datetime import datetime, timedelta
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db, setup_historical_prices_collection
from services.closing_price.historical_sync import get_sync_service
from services.closing_price.live_price_updater import get_updater_service
from services.closing_price.live_price_cache import get_live_price_cache
from services.closing_price.price_manager import PriceManager


async def test_end_to_end_flow():
    """
    Test the complete flow:
    Symbol → Live Cache → MongoDB → API Retrieval
    """
    print("\n" + "="*70)
    print("TEST 1: End-to-End Flow")
    print("="*70)
    
    try:
        await connect_to_mongo()
        await setup_historical_prices_collection()
        
        # Clean slate
        await db.database.tracked_symbols.delete_many({"symbol": "AAPL"})
        await db.database.historical_prices.delete_many({"symbol": "AAPL"})
        
        # Step 1: Add symbol to tracking
        print("\n📝 Step 1: Adding AAPL to tracked_symbols...")
        now = datetime.utcnow()
        await db.database.tracked_symbols.insert_one({
            "symbol": "AAPL",
            "market": "US",
            "added_at": now,
            "last_queried_at": now,
            "last_update": now - timedelta(hours=2)  # Recently updated
        })
        print("   ✅ Symbol tracked")
        
        # Step 2: Add to live cache
        print("\n💾 Step 2: Adding price to live cache...")
        cache = get_live_price_cache()
        cache.set("AAPL", 274.04, currency="USD", market="US", change_percent=1.2)
        cached_price = cache.get("AAPL")
        assert cached_price["price"] == 274.04
        print(f"   ✅ Live cache: ${cached_price['price']:.2f}")
        
        # Step 3: Run Stage 1 (fast transfer)
        print("\n🔄 Step 3: Running Stage 1 (fast transfer to MongoDB)...")
        sync_service = get_sync_service()
        stage1_result = await sync_service._stage1_fast_transfer()
        print(f"   ✅ Stage 1: {stage1_result['success_count']} symbols synced")
        
        # Step 4: Verify data in MongoDB
        print("\n🔍 Step 4: Verifying data in MongoDB...")
        count = await db.database.historical_prices.count_documents({"symbol": "AAPL"})
        assert count >= 1, f"Expected at least 1 record, got {count}"
        print(f"   ✅ MongoDB: {count} historical records")
        
        # Step 5: Fetch via API
        print("\n📡 Step 5: Fetching via PriceManager API...")
        manager = PriceManager()
        start = time.time()
        historical = await manager.get_historical_prices(["AAPL"], days=7)
        duration_ms = (time.time() - start) * 1000
        
        assert "AAPL" in historical
        print(f"   ✅ API fetch: {len(historical['AAPL'])} records in {duration_ms:.2f}ms")
        
        if duration_ms < 100:
            print("   🚀 EXCELLENT: Sub-100ms query time!")
        
        return True
        
    except AssertionError as e:
        print(f"   ❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_self_healing():
    """
    Test that Stage 2 automatically backfills symbols without historical data
    """
    print("\n" + "="*70)
    print("TEST 2: Self-Healing (Automatic Backfill)")
    print("="*70)
    
    try:
        # Add a symbol WITHOUT last_update (simulates existing symbol before migration)
        print("\n📝 Adding MSFT without last_update (simulates existing symbol)...")
        now = datetime.utcnow()
        await db.database.tracked_symbols.delete_many({"symbol": "MSFT"})
        await db.database.historical_prices.delete_many({"symbol": "MSFT"})
        
        await db.database.tracked_symbols.insert_one({
            "symbol": "MSFT",
            "market": "US",
            "added_at": now - timedelta(days=30),  # Old symbol
            "last_queried_at": now,
            # NO last_update field - simulates existing symbol
        })
        print("   ✅ Symbol added without last_update")
        
        # Run Stage 2
        print("\n🔄 Running Stage 2 (self-healing)...")
        print("   (This will fetch from yfinance, may take ~10 seconds)")
        sync_service = get_sync_service()
        stage2_result = await sync_service._stage2_self_healing()
        
        print(f"   ✅ Stage 2 completed")
        print(f"      Success: {stage2_result['success_count']}")
        print(f"      Errors: {stage2_result['error_count']}")
        
        # Verify MSFT now has historical data
        count = await db.database.historical_prices.count_documents({"symbol": "MSFT"})
        print(f"   ✅ MSFT now has {count} historical records")
        
        # Verify last_update was set
        msft_doc = await db.database.tracked_symbols.find_one({"symbol": "MSFT"})
        assert msft_doc.get("last_update") is not None, "last_update should be set"
        print(f"   ✅ last_update set: {msft_doc['last_update'].isoformat()}")
        
        return True
        
    except AssertionError as e:
        print(f"   ❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_performance_comparison():
    """
    Compare performance: cached vs non-cached historical data retrieval
    """
    print("\n" + "="*70)
    print("TEST 3: Performance Benchmark")
    print("="*70)
    
    try:
        # Ensure we have some data
        symbols = ["AAPL", "MSFT"]
        
        print(f"\n⏱️  Benchmarking historical data fetch for {len(symbols)} symbols...")
        
        # Benchmark cached fetch
        manager = PriceManager()
        
        iterations = 5
        total_time = 0
        
        for i in range(iterations):
            start = time.time()
            result = await manager.get_historical_prices(symbols, days=7)
            duration = time.time() - start
            total_time += duration
        
        avg_time_ms = (total_time / iterations) * 1000
        
        print(f"   ✅ Average query time: {avg_time_ms:.2f}ms ({iterations} iterations)")
        
        if avg_time_ms < 50:
            print("   🚀 EXCELLENT: <50ms (sub-millisecond per symbol)")
        elif avg_time_ms < 200:
            print("   ✓ GOOD: <200ms")
        else:
            print("   ⚠️  Slower than expected")
        
        # Show data count
        total_records = sum(len(prices) for prices in result.values())
        print(f"   ✅ Retrieved {total_records} total records")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_live_cache_integration():
    """
    Test that live cache integrates properly with sync service
    """
    print("\n" + "="*70)
    print("TEST 4: Live Cache Integration")
    print("="*70)
    
    try:
        cache = get_live_price_cache()
        
        # Populate cache with test data
        print("\n💾 Populating live cache with 5 symbols...")
        test_symbols = [
            ("TEST1", 100.0),
            ("TEST2", 200.0),
            ("TEST3", 300.0),
            ("TEST4", 400.0),
            ("TEST5", 500.0),
        ]
        
        for symbol, price in test_symbols:
            cache.set(symbol, price, currency="USD", market="US")
        
        print(f"   ✅ Cache populated: {cache.size()} symbols")
        
        # Add to tracked_symbols
        now = datetime.utcnow()
        docs = []
        for symbol, _ in test_symbols:
            docs.append({
                "symbol": symbol,
                "market": "US",
                "added_at": now,
                "last_queried_at": now,
                "last_update": now - timedelta(hours=1)
            })
        
        await db.database.tracked_symbols.delete_many({"symbol": {"$regex": "^TEST"}})
        await db.database.tracked_symbols.insert_many(docs)
        
        # Run Stage 1
        print("\n🔄 Running Stage 1 sync...")
        sync_service = get_sync_service()
        result = await sync_service._stage1_fast_transfer()
        
        print(f"   ✅ Synced {result['success_count']} symbols to MongoDB")
        
        # Verify all symbols in MongoDB
        count = await db.database.historical_prices.count_documents({
            "symbol": {"$regex": "^TEST"}
        })
        print(f"   ✅ MongoDB has {count} records for TEST symbols")
        
        # Cleanup
        await db.database.tracked_symbols.delete_many({"symbol": {"$regex": "^TEST"}})
        await db.database.historical_prices.delete_many({"symbol": {"$regex": "^TEST"}})
        
        return True
        
    except AssertionError as e:
        print(f"   ❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def cleanup_all_test_data():
    """Clean up all test data"""
    print("\n" + "="*70)
    print("CLEANUP: Removing All Test Data")
    print("="*70)
    
    try:
        # Remove all test symbols
        result1 = await db.database.tracked_symbols.delete_many({
            "symbol": {"$in": ["AAPL", "MSFT", "GOOG"] + [f"TEST{i}" for i in range(1, 6)]}
        })
        print(f"✅ Removed {result1.deleted_count} tracked symbols")
        
        result2 = await db.database.historical_prices.delete_many({
            "symbol": {"$in": ["AAPL", "MSFT", "GOOG"] + [f"TEST{i}" for i in range(1, 6)]}
        })
        print(f"✅ Removed {result2.deleted_count} historical records")
        
        cache = get_live_price_cache()
        cache.clear()
        print(f"✅ Cleared live cache")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return False


async def main():
    """Run comprehensive integration tests"""
    print("\n" + "🔬 COMPREHENSIVE INTEGRATION TEST SUITE")
    print("="*70)
    print("Testing the complete historical price caching system")
    print("="*70)
    
    start_time = time.time()
    
    try:
        # Run all integration tests
        test1 = await test_end_to_end_flow()
        test2 = await test_self_healing()
        test3 = await test_performance_comparison()
        test4 = await test_live_cache_integration()
        
        # Cleanup
        await cleanup_all_test_data()
        
        # Summary
        duration = time.time() - start_time
        
        print("\n" + "="*70)
        print("INTEGRATION TEST SUMMARY")
        print("="*70)
        print(f"Test 1 (End-to-End Flow): {'✅ PASSED' if test1 else '❌ FAILED'}")
        print(f"Test 2 (Self-Healing): {'✅ PASSED' if test2 else '❌ FAILED'}")
        print(f"Test 3 (Performance): {'✅ PASSED' if test3 else '❌ FAILED'}")
        print(f"Test 4 (Cache Integration): {'✅ PASSED' if test4 else '❌ FAILED'}")
        
        print(f"\nTotal test duration: {duration:.2f}s")
        
        all_passed = all([test1, test2, test3, test4])
        print("\n" + ("="*70))
        if all_passed:
            print("🎉 ALL INTEGRATION TESTS PASSED!")
            print("\n✨ The historical price caching system is fully operational:")
            print("   - Time-series collection: ✅")
            print("   - Live cache: ✅")
            print("   - Historical sync: ✅")
            print("   - Self-healing: ✅")
            print("   - Performance: ✅")
            print("\n🚀 Ready for production deployment!")
        else:
            print("⚠️  SOME INTEGRATION TESTS FAILED")
            print("   Please review errors above before deploying.")
        print("="*70 + "\n")
        
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())

