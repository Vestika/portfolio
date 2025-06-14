#!/usr/bin/env python3
"""
Test the robust price fetching system with real-world restrictions.
Demonstrates graceful handling of:
1. Alpha Vantage premium-only symbols
2. Missing TASE symbol mappings
3. Yahoo Finance API failures
"""

import os
from pathlib import Path
from playground.models.portfolio import Portfolio
from playground.portfolio_calculator import PortfolioCalculator

def main():
    print("🧪 Testing Robust Price Fetching with Real-World Restrictions")
    print("=" * 70)
    
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
    
    print()
    print("💼 Portfolio Analysis:")
    print(f"   Base currency: {portfolio.base_currency}")
    print(f"   Securities: {len(portfolio.securities)}")
    print(f"   Accounts: {len(portfolio.accounts)}")
    print()
    
    # Test problematic securities
    test_securities = [
        ("5118393", "Bond with predefined price - should work"),
        ("VTI", "ETF - Alpha Vantage premium only"),
        ("MSFT", "Stock - Alpha Vantage premium only"),
        ("1185164", "TASE ETF - mapping issue"),
        ("META", "Stock - Alpha Vantage premium only"),
    ]
    
    print("🔍 Testing Individual Securities:")
    print("-" * 70)
    
    for symbol, description in test_securities:
        if symbol in portfolio.securities:
            security = portfolio.securities[symbol]
            try:
                result = calculator.calc_holding_value(security, 100, portfolio)
                
                status = "✅ SUCCESS" if result['unit_price'] > 0 else "⚠️  FALLBACK"
                print(f"{symbol:10} | {result['unit_price']:>8.2f} {security.currency} | "
                      f"{result['price_source']:>12} | {status} | {description}")
                      
            except Exception as e:
                print(f"{symbol:10} | {'ERROR':>8} | {'failed':>12} | ❌ FAILED | {str(e)}")
        else:
            print(f"{symbol:10} | {'N/A':>8} | {'missing':>12} | ❌ MISSING | Not in portfolio")
    
    print()
    print("📈 Portfolio Aggregation Test:")
    print("-" * 40)
    
    try:
        # Test the full portfolio aggregation (this was failing before)
        aggregation_data = calculator.aggregate_holdings(
            portfolio=portfolio,
            aggregation_key=None,  # Aggregate by account
            account_filter=None,
            security_filter=None,
            ignore_missing_key=False,
        )
        
        total_value = sum(aggregation_data.values())
        print(f"✅ Portfolio aggregation successful!")
        print(f"   Total value: {total_value:,.0f} {portfolio.base_currency}")
        print(f"   Accounts processed: {len(aggregation_data)}")
        
        for account, value in aggregation_data.items():
            print(f"   {account}: {value:,.0f} {portfolio.base_currency}")
            
    except Exception as e:
        print(f"❌ Portfolio aggregation failed: {str(e)}")
    
    print()
    print("📋 System Summary:")
    print("-" * 30)
    print(f"💾 Cached prices: {len(calculator.real_prices)}")
    print(f"🔧 Predefined prices: {len(calculator.unit_prices)}")
    print(f"🗺️  TASE mappings loaded: {len(calculator.tase_id_to_symbol)}")
    
    if calculator.real_prices:
        print("\n🗄️  Successfully cached prices:")
        for symbol, price in sorted(calculator.real_prices.items()):
            print(f"   {symbol}: ${price:.2f}")
    
    print("\n✅ Robust system test completed!")

if __name__ == "__main__":
    main() 