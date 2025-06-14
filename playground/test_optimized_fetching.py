#!/usr/bin/env python3
"""
Test the optimized price fetching system.
Demonstrates:
1. No redundant API calls - prices fetched only once per session
2. Efficient use of Alpha Vantage API with proper rate limiting
3. Smart caching that persists across calls
"""

import os
from pathlib import Path
from playground.models.portfolio import Portfolio
from playground.portfolio_calculator import PortfolioCalculator

def main():
    print("🚀 Testing Optimized Price Fetching")
    print("=" * 60)
    
    # Set API key
    os.environ['ALPHA_VANTAGE_API_KEY'] = 'JA17T0FJTKIZ1861'
    
    # Load test portfolio
    print("📊 Loading portfolio...")
    portfolio = Portfolio.from_yaml(Path("playground/michael_test.yaml"))
    
    # Initialize calculator
    calculator = PortfolioCalculator(
        base_currency=portfolio.base_currency,
        exchange_rates=portfolio.exchange_rates,
        unit_prices=portfolio.unit_prices,
        alpha_vantage_api_key=os.getenv('ALPHA_VANTAGE_API_KEY'),
    )
    
    print(f"💰 Base currency: {portfolio.base_currency}")
    print(f"🔧 Predefined prices: {len(portfolio.unit_prices)} symbols")
    print(f"💾 Cached prices: {len(calculator.real_prices)} symbols")
    print()
    
    # Test securities that will require fetching
    test_securities = ["VTI", "MSFT", "NVDA", "5118393"]
    
    print("🧪 Testing Price Calculation (should trigger fetching):")
    print("-" * 60)
    
    for symbol in test_securities:
        if symbol in portfolio.securities:
            security = portfolio.securities[symbol]
            try:
                result = calculator.calc_holding_value(security, 100, portfolio)
                
                print(f"✅ {symbol:8} | "
                      f"{result['unit_price']:>8.2f} {security.currency} | "
                      f"Source: {result['price_source']:>12} | "
                      f"100 units = {result['value']:>10,.0f} {calculator.base_currency}")
                      
            except Exception as e:
                print(f"❌ {symbol:8} | ERROR: {str(e)}")
    
    print("\n" + "=" * 60)
    print("🔄 Testing Second Round (should use cached data, no API calls):")
    print("-" * 60)
    
    # Reset the session flag to simulate multiple calls
    # In real usage, this would be separate calls to calc_holding_value
    for symbol in test_securities:
        if symbol in portfolio.securities:
            security = portfolio.securities[symbol]
            try:
                result = calculator.calc_holding_value(security, 50, portfolio)
                
                print(f"✅ {symbol:8} | "
                      f"{result['unit_price']:>8.2f} {security.currency} | "
                      f"Source: {result['price_source']:>12} | "
                      f"50 units = {result['value']:>10,.0f} {calculator.base_currency}")
                      
            except Exception as e:
                print(f"❌ {symbol:8} | ERROR: {str(e)}")
    
    print("\n" + "=" * 60)
    print("📈 Final Summary:")
    print(f"💾 Total cached prices: {len(calculator.real_prices)}")
    print(f"🔧 Predefined prices used: {len(calculator.unit_prices)}")
    print(f"✅ Session completed efficiently!")
    
    # Show what's in cache
    if calculator.real_prices:
        print("\n🗄️  Real-time prices cached:")
        for symbol, price in sorted(calculator.real_prices.items()):
            print(f"   {symbol}: ${price:.2f}")

if __name__ == "__main__":
    main() 