#!/usr/bin/env python3
"""
Test script to verify price fetching behavior.
This script will test that:
1. Prices defined in unit_prices (YAML) are used when available
2. Real-time prices are fetched when unit_prices are missing
3. The system shows the source of each price (predefined vs real-data)
"""

from pathlib import Path
from playground.models.portfolio import Portfolio
from playground.portfolio_calculator import PortfolioCalculator

def test_price_fetching():
    print("=== Testing Price Fetching Behavior ===\n")
    
    # Load the test portfolio with minimal unit_prices
    print("Loading test portfolio (michael_test.yaml)...")
    portfolio = Portfolio.from_yaml(Path("playground/michael_test.yaml"))
    
    calculator = PortfolioCalculator(
        base_currency=portfolio.base_currency,
        exchange_rates=portfolio.exchange_rates,
        unit_prices=portfolio.unit_prices,
    )
    
    print(f"Base currency: {portfolio.base_currency}")
    print(f"Unit prices defined in YAML: {list(portfolio.unit_prices.keys())}")
    print()
    
    # Test some securities to see price sources
    test_symbols = ["VTI", "MSFT", "NVDA", "GOOG", "5118393", "META", "TSLA", "SMH"]
    
    print("=== Testing Price Sources ===")
    for symbol in test_symbols:
        if symbol in portfolio.securities:
            security = portfolio.securities[symbol]
            try:
                # Force fetching of latest prices
                calculator.fetch_latest_prices(portfolio)
                
                result = calculator.calc_holding_value(security, 1)
                
                print(f"{symbol:8} | {result['unit_price']:>10.2f} {security.currency} | Source: {result['price_source']:>12} | {security.name}")
                
            except Exception as e:
                print(f"{symbol:8} | ERROR: {str(e)}")
        else:
            print(f"{symbol:8} | Not found in portfolio")
    
    print()
    print("=== Real Prices Cache ===")
    print(f"Real prices fetched: {len(calculator.real_prices)} symbols")
    for symbol, price in sorted(calculator.real_prices.items()):
        print(f"  {symbol}: {price:.2f}")
    
    print()
    print("=== Sample Portfolio Calculation ===")
    # Test a small account to see mixed price sources
    test_holdings = [
        ("VTI", 10),    # Should use real-time price
        ("NVDA", 5),    # Should use real-time price  
        ("5118393", 100)  # Should use predefined price
    ]
    
    total_value = 0
    for symbol, units in test_holdings:
        if symbol in portfolio.securities:
            security = portfolio.securities[symbol]
            try:
                result = calculator.calc_holding_value(security, units)
                value_in_base = result['value']
                total_value += value_in_base
                
                print(f"{units:4} x {symbol:8} = {value_in_base:>10,.0f} {portfolio.base_currency} (source: {result['price_source']})")
            except Exception as e:
                print(f"{units:4} x {symbol:8} = ERROR: {str(e)}")
    
    print(f"{'':4}   {'Total':8} = {total_value:>10,.0f} {portfolio.base_currency}")

if __name__ == "__main__":
    test_price_fetching() 