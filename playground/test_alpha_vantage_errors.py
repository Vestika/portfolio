#!/usr/bin/env python3
"""
Quick test to see the full Alpha Vantage error messages.
"""

import os
from playground.utils.price_fetchers import AlphaVantageFetcher

def main():
    print("🔍 Testing Alpha Vantage Error Messages")
    print("=" * 50)
    
    # Set API key
    os.environ['ALPHA_VANTAGE_API_KEY'] = 'JA17T0FJTKIZ1861'
    
    try:
        fetcher = AlphaVantageFetcher()
        
        # Test a few symbols that we know are causing issues
        test_symbols = ["VTI", "MSFT"]
        
        print(f"Testing {len(test_symbols)} symbols to see full error messages...")
        print()
        
        prices = fetcher.fetch_prices(test_symbols)
        
        print()
        print(f"Results: {len(prices)} prices fetched")
        for symbol, price in prices.items():
            print(f"  {symbol}: ${price:.2f}")
            
    except Exception as e:
        print(f"Fetcher initialization failed: {str(e)}")

if __name__ == "__main__":
    main() 