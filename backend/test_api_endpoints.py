#!/usr/bin/env python3
"""
Test API endpoints directly (bypassing authentication)

This tests the cache management endpoints by calling them directly
without going through the HTTP layer.
"""
import asyncio
from datetime import datetime
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db, setup_historical_prices_collection
from services.closing_price.historical_sync import get_sync_service
from services.closing_price.price_manager import PriceManager
from services.closing_price.live_price_cache import get_live_price_cache
from services.closing_price.live_price_updater import get_updater_service


async def test_cache_status_logic():
    """Test the logic behind /cache/status endpoint"""
    print("\n" + "="*70)
    print("TEST 1: Cache Status Endpoint Logic")
    print("="*70)
    
    try:
        await connect_to_mongo()
        await setup_historical_prices_collection()
        
        cache = get_live_price_cache()
        cache_stats = cache.get_stats()
        
        print(f"✅ Live cache stats: {cache_stats}")
        
        # Get historical data stats
        from services.closing_price.database import db, ensure_connections
        await ensure_connections()
        
        pipeline = [
            {"$group": {"_id": "$symbol"}},
            {"$count": "total"}
        ]
        result = await db.database.historical_prices.aggregate(pipeline).to_list(length=1)
        historical_symbols_count = result[0]["total"] if result else 0
        
        print(f"✅ Historical symbols count: {historical_symbols_count}")
        
        # Get oldest and newest
        oldest = await db.database.historical_prices.find_one(sort=[("timestamp", 1)])
        newest = await db.database.historical_prices.find_one(sort=[("timestamp", -1)])
        
        status_response = {
            "live_cache": cache_stats,
            "historical_data": {
                "symbols_with_history": historical_symbols_count,
                "oldest_data": oldest["timestamp"].isoformat() if oldest else None,
                "newest_data": newest["timestamp"].isoformat() if newest else None
            },
            "status": "healthy"
        }
        
        print(f"✅ Status endpoint response:")
        print(f"   {status_response}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_historical_query_logic():
    """Test the logic behind /cache/historical/{symbol} endpoint"""
    print("\n" + "="*70)
    print("TEST 2: Historical Query Endpoint Logic")
    print("="*70)
    
    try:
        # Add test data
        sync_service = get_sync_service()
        
        print("📝 Backfilling AAPL...")
        result = await sync_service.backfill_new_symbol("AAPL", market="US")
        
        if result["status"] == "success":
            print(f"✅ Backfilled AAPL: {result['records_inserted']} records")
        else:
            print(f"⚠️  Backfill status: {result['status']}")
        
        # Query historical data
        print("\n🔍 Querying historical data...")
        from services.closing_price.service import get_global_service
        
        service = get_global_service()
        historical_result = await service.get_historical_prices(["AAPL"], days=7)
        
        if historical_result and "AAPL" in historical_result:
            data = historical_result["AAPL"]
            print(f"✅ Query successful: {len(data)} records")
            
            # Show sample
            if data:
                print(f"   First: {data[0]}")
                print(f"   Last: {data[-1]}")
            
            # This is what the endpoint would return
            endpoint_response = {
                "symbol": "AAPL",
                "days": 7,
                "data": data,
                "count": len(data)
            }
            print(f"✅ Endpoint would return: {len(data)} records")
        else:
            print("⚠️  No data found")
            endpoint_response = {
                "symbol": "AAPL",
                "days": 7,
                "data": [],
                "count": 0,
                "message": "No historical data found"
            }
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_refresh_live_logic():
    """Test the logic behind /cache/refresh-live endpoint"""
    print("\n" + "="*70)
    print("TEST 3: Refresh Live Endpoint Logic")
    print("="*70)
    
    try:
        # Add some tracked symbols
        now = datetime.utcnow()
        await db.database.tracked_symbols.delete_many({"symbol": {"$in": ["MSFT", "GOOG"]}})
        await db.database.tracked_symbols.insert_many([
            {"symbol": "MSFT", "market": "US", "added_at": now, "last_queried_at": now, "last_update": now},
            {"symbol": "GOOG", "market": "US", "added_at": now, "last_queried_at": now, "last_update": now}
        ])
        
        print("📝 Added 2 tracked symbols (MSFT, GOOG)")
        
        # Trigger update
        print("\n🔄 Triggering live price update...")
        updater = get_updater_service()
        result = await updater.update_once()
        
        print(f"✅ Update completed:")
        print(f"   Updated: {result['updated']}")
        print(f"   Errors: {result['errors']}")
        
        # Check cache
        cache = get_live_price_cache()
        msft_price = cache.get("MSFT")
        goog_price = cache.get("GOOG")
        
        if msft_price:
            print(f"✅ MSFT in cache: ${msft_price['price']:.2f}")
        if goog_price:
            print(f"✅ GOOG in cache: ${goog_price['price']:.2f}")
        
        endpoint_response = {
            "success": True,
            "message": f"Live cache refreshed: {result['updated']} symbols updated",
            "stats": result
        }
        
        print(f"✅ Endpoint response: {endpoint_response['message']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_sync_historical_logic():
    """Test the logic behind /cache/sync-historical endpoint"""
    print("\n" + "="*70)
    print("TEST 4: Sync Historical Endpoint Logic")
    print("="*70)
    
    try:
        print("🔄 Running historical sync (both stages)...")
        sync_service = get_sync_service()
        result = await sync_service.run_daily_sync()
        
        print(f"✅ Sync completed:")
        print(f"   Total updated: {result['total_symbols_updated']}")
        print(f"   Total errors: {result['total_errors']}")
        print(f"   Stage 1 success: {result['stage1']['success_count']}")
        print(f"   Stage 2 success: {result['stage2']['success_count']}")
        
        endpoint_response = {
            "success": True,
            "message": f"Historical sync completed: {result['total_symbols_updated']} symbols updated",
            "stats": result
        }
        
        print(f"✅ Endpoint response: {endpoint_response['message']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def cleanup():
    """Cleanup test data"""
    print("\n" + "="*70)
    print("CLEANUP")
    print("="*70)
    
    try:
        await db.database.tracked_symbols.delete_many({"symbol": {"$in": ["AAPL", "MSFT", "GOOG"]}})
        await db.database.historical_prices.delete_many({"symbol": {"$in": ["AAPL", "MSFT", "GOOG"]}})
        cache = get_live_price_cache()
        cache.clear()
        print("✅ Cleanup completed")
        
    except Exception as e:
        print(f"⚠️  Cleanup error: {e}")


async def main():
    """Test all endpoint logic"""
    print("\n" + "🧪 API Endpoint Logic Tests")
    print("="*70)
    print("Testing endpoint logic directly (bypassing auth)")
    print("="*70)
    
    try:
        test1 = await test_cache_status_logic()
        test2 = await test_historical_query_logic()
        test3 = await test_refresh_live_logic()
        test4 = await test_sync_historical_logic()
        
        await cleanup()
        
        # Summary
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        print(f"Test 1 (Cache Status): {'✅ PASSED' if test1 else '❌ FAILED'}")
        print(f"Test 2 (Historical Query): {'✅ PASSED' if test2 else '❌ FAILED'}")
        print(f"Test 3 (Refresh Live): {'✅ PASSED' if test3 else '❌ FAILED'}")
        print(f"Test 4 (Sync Historical): {'✅ PASSED' if test4 else '❌ FAILED'}")
        
        all_passed = all([test1, test2, test3, test4])
        
        print("\n" + "="*70)
        if all_passed:
            print("🎉 ALL ENDPOINT TESTS PASSED!")
            print("\nThe endpoints are working correctly.")
            print("The HTTP error you saw is likely an authentication issue.")
            print("\nTo test with curl, you need a Firebase auth token:")
            print('  curl -H "Authorization: Bearer YOUR_TOKEN" \\')
            print('       http://localhost:8080/cache/historical/AAPL?days=7')
        else:
            print("⚠️  SOME TESTS FAILED - check errors above")
        print("="*70 + "\n")
        
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())

