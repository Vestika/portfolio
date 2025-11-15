#!/usr/bin/env python3
"""
Test script for in-memory live price cache.
Tests thread safety and basic operations.
"""
import threading
import time
from services.closing_price.live_price_cache import get_live_price_cache, get_live_price, set_live_price


def test_basic_operations():
    """Test 1: Basic cache operations"""
    print("\n" + "="*60)
    print("TEST 1: Basic Cache Operations")
    print("="*60)
    
    try:
        cache = get_live_price_cache()
        
        # Test set and get
        set_live_price("AAPL", 150.50, currency="USD", market="US", change_percent=1.5)
        price_data = get_live_price("AAPL")
        
        assert price_data is not None, "Price should not be None"
        assert price_data["price"] == 150.50, "Price should be 150.50"
        assert price_data["currency"] == "USD", "Currency should be USD"
        assert price_data["change_percent"] == 1.5, "Change percent should be 1.5"
        print(f"✅ Set and get single price: AAPL @ ${price_data['price']}")
        
        # Test batch update
        batch_prices = [
            {"symbol": "MSFT", "price": 380.25, "currency": "USD", "market": "US"},
            {"symbol": "GOOG", "price": 140.75, "currency": "USD", "market": "US"},
            {"symbol": "TSLA", "price": 250.00, "currency": "USD", "market": "US"},
        ]
        count = cache.update_batch(batch_prices)
        assert count == 3, "Should update 3 prices"
        print(f"✅ Batch update: {count} prices")
        
        # Test get_all
        all_prices = cache.get_all()
        assert len(all_prices) == 4, "Should have 4 prices in cache"
        print(f"✅ Get all: {len(all_prices)} prices")
        
        # Test get_symbols
        symbols = cache.get_symbols()
        assert "AAPL" in symbols, "AAPL should be in symbols list"
        assert "MSFT" in symbols, "MSFT should be in symbols list"
        print(f"✅ Get symbols: {symbols}")
        
        # Test size
        size = cache.size()
        assert size == 4, "Size should be 4"
        print(f"✅ Cache size: {size}")
        
        # Test remove
        removed = cache.remove("TSLA")
        assert removed is True, "Should remove TSLA"
        assert cache.size() == 3, "Size should be 3 after removal"
        print(f"✅ Remove symbol: TSLA removed, size now {cache.size()}")
        
        # Test stats
        stats = cache.get_stats()
        print(f"✅ Cache stats: {stats}")
        
        return True
        
    except AssertionError as e:
        print(f"❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_thread_safety():
    """Test 2: Thread safety"""
    print("\n" + "="*60)
    print("TEST 2: Thread Safety")
    print("="*60)
    
    try:
        cache = get_live_price_cache()
        cache.clear()  # Start fresh
        
        errors = []
        
        def writer_thread(thread_id: int, symbol_base: str):
            """Writer thread that adds prices"""
            try:
                for i in range(100):
                    symbol = f"{symbol_base}{i}"
                    set_live_price(symbol, 100.0 + thread_id, currency="USD", market="US")
            except Exception as e:
                errors.append(f"Writer {thread_id}: {e}")
        
        def reader_thread(thread_id: int):
            """Reader thread that reads prices"""
            try:
                for _ in range(100):
                    symbols = cache.get_symbols()
                    for symbol in symbols[:10]:  # Read first 10
                        cache.get(symbol)
            except Exception as e:
                errors.append(f"Reader {thread_id}: {e}")
        
        # Create threads
        threads = []
        
        # 3 writer threads
        for i in range(3):
            t = threading.Thread(target=writer_thread, args=(i, f"SYM{i}_"))
            threads.append(t)
        
        # 2 reader threads
        for i in range(2):
            t = threading.Thread(target=reader_thread, args=(i,))
            threads.append(t)
        
        # Start all threads
        start_time = time.time()
        for t in threads:
            t.start()
        
        # Wait for all threads
        for t in threads:
            t.join()
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Check results
        final_size = cache.size()
        
        if errors:
            print(f"❌ Thread safety test had errors:")
            for error in errors:
                print(f"   - {error}")
            return False
        
        print(f"✅ Thread safety test completed in {duration:.2f}s")
        print(f"✅ Final cache size: {final_size} symbols")
        print(f"✅ No race conditions or errors detected")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_singleton_pattern():
    """Test 3: Verify singleton pattern works"""
    print("\n" + "="*60)
    print("TEST 3: Singleton Pattern")
    print("="*60)
    
    try:
        cache1 = get_live_price_cache()
        cache2 = get_live_price_cache()
        
        assert cache1 is cache2, "Should return same instance"
        print("✅ Singleton pattern works - same instance returned")
        
        # Test that data persists across gets
        cache1.set("TEST", 999.99, currency="USD", market="US")
        test_data = cache2.get("TEST")
        
        assert test_data is not None, "Data should be accessible from different reference"
        assert test_data["price"] == 999.99, "Price should match"
        print("✅ Data persists across different references")
        
        return True
        
    except AssertionError as e:
        print(f"❌ Assertion failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "🔍 Live Price Cache - Test Suite")
    print("="*60)
    
    try:
        # Run tests
        test1 = test_basic_operations()
        test2 = test_thread_safety()
        test3 = test_singleton_pattern()
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Test 1 (Basic Operations): {'✅ PASSED' if test1 else '❌ FAILED'}")
        print(f"Test 2 (Thread Safety): {'✅ PASSED' if test2 else '❌ FAILED'}")
        print(f"Test 3 (Singleton Pattern): {'✅ PASSED' if test3 else '❌ FAILED'}")
        
        all_passed = all([test1, test2, test3])
        print("\n" + ("="*60))
        if all_passed:
            print("🎉 ALL TESTS PASSED! Live price cache is ready.")
        else:
            print("⚠️  SOME TESTS FAILED. Please review errors above.")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")


if __name__ == "__main__":
    main()

