#!/usr/bin/env python3
"""
Comprehensive test for the new multi-provider price fetching system.
Tests both Alpha Vantage (primary) and Yahoo Finance (fallback) providers.
"""

import os
from pathlib import Path
from playground.models.portfolio import Portfolio
from playground.portfolio_calculator import PortfolioCalculator
from playground.utils.price_fetchers import get_price_fetcher
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Set up logging to see what's happening
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_price_fetchers():
    """Test the individual price fetchers."""
    print("=== Testing Price Fetchers ===\n")
    
    # Test without API key (should only use Yahoo Finance)
    print("1. Testing without Alpha Vantage API key:")
    try:
        fetcher_no_key = get_price_fetcher()
        print(f"   Available providers: {len(fetcher_no_key.providers)}")
        
        # Test a few symbols
        test_symbols = ["VTI", "MSFT"]
        prices, provider = fetcher_no_key.fetch_prices(test_symbols)
        print(f"   Fetched {len(prices)} prices using {provider}")
        for symbol, price in prices.items():
            print(f"   {symbol}: ${price:.2f}")
            
    except Exception as e:
        print(f"   Error: {str(e)}")
    
    print()
    
    # Test with API key (if available)
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if api_key:
        print("2. Testing with Alpha Vantage API key:")
        try:
            fetcher_with_key = get_price_fetcher(api_key)
            print(f"   Available providers: {len(fetcher_with_key.providers)}")
            
            # Test just one symbol due to rate limits
            test_symbols = ["MSFT"]
            prices, provider = fetcher_with_key.fetch_prices(test_symbols)
            print(f"   Fetched {len(prices)} prices using {provider}")
            for symbol, price in prices.items():
                print(f"   {symbol}: ${price:.2f}")
                
        except Exception as e:
            print(f"   Error: {str(e)}")
    else:
        print("2. No Alpha Vantage API key found in environment")
        print("   Set ALPHA_VANTAGE_API_KEY to test Alpha Vantage")
        print("   Get your free key from: https://www.alphavantage.co/support/#api-key")


def test_portfolio_integration():
    """Test the portfolio calculator with the new price system."""
    print("\n=== Testing Portfolio Integration ===\n")
    
    # Load test portfolio
    portfolio = Portfolio.from_yaml(Path("playground/michael_test.yaml"))
    
    # Test with environment API key
    calculator = PortfolioCalculator(
        base_currency=portfolio.base_currency,
        exchange_rates=portfolio.exchange_rates,
        unit_prices=portfolio.unit_prices,
        alpha_vantage_api_key=os.getenv('ALPHA_VANTAGE_API_KEY'),
    )
    
    print(f"Base currency: {portfolio.base_currency}")
    print(f"Predefined prices: {list(portfolio.unit_prices.keys())}")
    print(f"Cached prices: {list(calculator.real_prices.keys())}")
    print()
    
    # Test different securities
    test_cases = [
        ("5118393", "Bond with predefined price"),
        ("VTI", "ETF - should fetch real-time"),
        ("MSFT", "Stock - should fetch real-time"),
        ("GOOG", "Stock - should fetch real-time"),
    ]
    
    print("Testing Price Sources:")
    print("Symbol   | Price      | Source      | Status | Description")
    print("-" * 70)
    
    for symbol, description in test_cases:
        if symbol in portfolio.securities:
            security = portfolio.securities[symbol]
            try:
                # This will trigger price fetching if needed
                calculator.fetch_latest_prices(portfolio)
                
                result = calculator.calc_holding_value(security, 1)
                status = "✅ SUCCESS"
                price_str = f"{result['unit_price']:>8.2f} {security.currency}"
                source = result['price_source']
                
            except Exception as e:
                status = "❌ FAILED"
                price_str = "    N/A"
                source = f"error: {str(e)}"
            
            print(f"{symbol:8} | {price_str} | {source:>11} | {status} | {description}")
    
    print()
    print("=== System Status ===")
    print(f"✅ Multi-provider system initialized")
    print(f"📊 Real prices in cache: {len(calculator.real_prices)}")
    print(f"🔧 Predefined prices: {len(calculator.unit_prices)}")
    
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if api_key:
        print(f"🔑 Alpha Vantage API key: ✅ Available")
    else:
        print(f"🔑 Alpha Vantage API key: ❌ Not set")
        print("   Running with Yahoo Finance fallback only")


def show_setup_instructions():
    """Show setup instructions for Alpha Vantage."""
    print("\n=== Setup Instructions ===")
    print("To use Alpha Vantage for more reliable price fetching:")
    print("1. Get a free API key from: https://www.alphavantage.co/support/#api-key")
    print("2. Set the environment variable: export ALPHA_VANTAGE_API_KEY=your_key_here")
    print("3. Or create a .env file with: ALPHA_VANTAGE_API_KEY=your_key_here")
    print("4. Free tier allows 25 requests/day, 5 requests/minute")
    print()
    print("The system will work with Yahoo Finance as fallback if no API key is provided.")


if __name__ == "__main__":
    print("🚀 Testing New Multi-Provider Price Fetching System")
    print("="*60)
    
    test_price_fetchers()
    test_portfolio_integration()
    show_setup_instructions()
    
    print("\n" + "="*60)
    print("✅ Testing complete!") 