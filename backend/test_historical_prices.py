#!/usr/bin/env python3
"""
Test script for historical price caching system.
Run this to verify that the time-series collection is set up correctly.
"""
import asyncio
from datetime import datetime, timedelta
from services.closing_price.database import connect_to_mongo, close_mongo_connection, db, setup_historical_prices_collection
from services.closing_price.models import HistoricalPrice, TrackedSymbol


async def test_time_series_collection():
    """Test 1: Verify time-series collection creation"""
    print("\n" + "="*60)
    print("TEST 1: Time-Series Collection Setup")
    print("="*60)
    
    try:
        # Connect to database
        await connect_to_mongo()
        print("✅ Connected to MongoDB")
        
        # Setup collection
        await setup_historical_prices_collection()
        print("✅ Time-series collection setup completed")
        
        # Verify collection exists
        collections = await db.database.list_collection_names()
        if "historical_prices" in collections:
            print("✅ historical_prices collection exists")
        else:
            print("❌ historical_prices collection NOT found")
            return False
        
        # Check collection stats
        stats = await db.database.command("collStats", "historical_prices")
        print(f"✅ Collection type: {stats.get('type', 'unknown')}")
        if stats.get('timeseries'):
            print(f"✅ Time-series config: {stats['timeseries']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


async def test_insert_historical_data():
    """Test 2: Insert sample historical data"""
    print("\n" + "="*60)
    print("TEST 2: Insert Sample Historical Data")
    print("="*60)
    
    try:
        # Create sample historical prices for AAPL (last 7 days)
        today = datetime.utcnow().replace(hour=20, minute=0, second=0, microsecond=0)
        sample_data = []
        
        for i in range(7, 0, -1):
            date = today - timedelta(days=i)
            sample_data.append(HistoricalPrice(
                timestamp=date,
                symbol="AAPL",
                close=150.0 + i,
                open=149.0 + i,
                high=151.0 + i,
                low=148.0 + i,
                volume=1000000
            ))
        
        # Insert data
        result = await db.database.historical_prices.insert_many(
            [price.dict(by_alias=True, exclude={"id"}) for price in sample_data]
        )
        print(f"✅ Inserted {len(result.inserted_ids)} historical price records")
        
        # Query data back
        cursor = db.database.historical_prices.find({"symbol": "AAPL"}).sort("timestamp", 1)
        fetched_data = await cursor.to_list(length=None)
        print(f"✅ Retrieved {len(fetched_data)} records for AAPL")
        
        # Display sample
        if fetched_data:
            first = fetched_data[0]
            last = fetched_data[-1]
            print(f"   First: {first['timestamp'].strftime('%Y-%m-%d')} - Close: ${first['close']:.2f}")
            print(f"   Last:  {last['timestamp'].strftime('%Y-%m-%d')} - Close: ${last['close']:.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


async def test_tracked_symbol_with_last_update():
    """Test 3: Verify TrackedSymbol model with lastUpdate field"""
    print("\n" + "="*60)
    print("TEST 3: TrackedSymbol with lastUpdate Field")
    print("="*60)
    
    try:
        # Create a tracked symbol with lastUpdate
        tracked = TrackedSymbol(
            symbol="AAPL",
            market="US",
            added_at=datetime.utcnow(),
            last_queried_at=datetime.utcnow(),
            last_update=datetime.utcnow() - timedelta(days=1)
        )
        
        # Insert into database (upsert to avoid duplicates)
        await db.database.tracked_symbols.update_one(
            {"symbol": "AAPL"},
            {"$set": tracked.dict(by_alias=True, exclude={"id"})},
            upsert=True
        )
        print("✅ Inserted TrackedSymbol with last_update field")
        
        # Query back
        fetched = await db.database.tracked_symbols.find_one({"symbol": "AAPL"})
        if fetched:
            print(f"✅ Retrieved TrackedSymbol: {fetched['symbol']}")
            print(f"   last_update: {fetched.get('last_update', 'NOT SET')}")
            print(f"   last_queried_at: {fetched.get('last_queried_at', 'NOT SET')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


async def test_query_performance():
    """Test 4: Test query performance for 7-day historical data"""
    print("\n" + "="*60)
    print("TEST 4: Query Performance (7-day historical data)")
    print("="*60)
    
    try:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        start_time = datetime.utcnow()
        cursor = db.database.historical_prices.find({
            "symbol": "AAPL",
            "timestamp": {"$gte": seven_days_ago}
        }).sort("timestamp", 1)
        
        results = await cursor.to_list(length=None)
        end_time = datetime.utcnow()
        
        duration_ms = (end_time - start_time).total_seconds() * 1000
        
        print(f"✅ Query completed in {duration_ms:.2f}ms")
        print(f"✅ Retrieved {len(results)} records")
        
        # Should be very fast with time-series collection
        if duration_ms < 100:
            print("🚀 EXCELLENT: Query is very fast (<100ms)")
        elif duration_ms < 500:
            print("✓ GOOD: Query is fast (<500ms)")
        else:
            print("⚠️  WARNING: Query is slower than expected (>500ms)")
        
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
        # Remove test historical data
        result1 = await db.database.historical_prices.delete_many({"symbol": "AAPL"})
        print(f"✅ Removed {result1.deleted_count} historical price records")
        
        # Remove test tracked symbol
        result2 = await db.database.tracked_symbols.delete_many({"symbol": "AAPL"})
        print(f"✅ Removed {result2.deleted_count} tracked symbol records")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return False


async def main():
    """Run all tests"""
    print("\n" + "🔍 Historical Price Caching System - Test Suite")
    print("="*60)
    
    try:
        # Run tests
        test1 = await test_time_series_collection()
        test2 = await test_insert_historical_data()
        test3 = await test_tracked_symbol_with_last_update()
        test4 = await test_query_performance()
        
        # Cleanup
        await cleanup_test_data()
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Test 1 (Collection Setup): {'✅ PASSED' if test1 else '❌ FAILED'}")
        print(f"Test 2 (Insert Data): {'✅ PASSED' if test2 else '❌ FAILED'}")
        print(f"Test 3 (TrackedSymbol Model): {'✅ PASSED' if test3 else '❌ FAILED'}")
        print(f"Test 4 (Query Performance): {'✅ PASSED' if test4 else '❌ FAILED'}")
        
        all_passed = all([test1, test2, test3, test4])
        print("\n" + ("="*60))
        if all_passed:
            print("🎉 ALL TESTS PASSED! Time-series collection is ready.")
        else:
            print("⚠️  SOME TESTS FAILED. Please review errors above.")
        print("="*60 + "\n")
        
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())

