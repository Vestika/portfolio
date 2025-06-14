#!/usr/bin/env python3
"""
Simple test to check Yahoo Finance API connectivity with individual symbol requests.
"""

import yfinance as yf
from pathlib import Path
from playground.models.portfolio import Portfolio
from playground.portfolio_calculator import PortfolioCalculator

def test_individual_symbols():
    print("=== Testing Individual Yahoo Finance API Calls ===\n")
    
    # Test a few individual symbols
    test_symbols = ["MSFT", "VTI", "NVDA"]
    
    for symbol in test_symbols:
        try:
            print(f"Fetching {symbol}...")
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1d")
            if not hist.empty:
                latest_price = hist['Close'].iloc[-1]
                print(f"  ✅ {symbol}: ${latest_price:.2f}")
            else:
                print(f"  ❌ {symbol}: No data returned")
        except Exception as e:
            print(f"  ❌ {symbol}: Error - {str(e)}")
    
    print("\n=== Testing yfinance download function ===")
    try:
        data = yf.download("MSFT", period="1d", progress=False)
        if not data.empty:
            price = data['Close'].iloc[-1]
            print(f"✅ MSFT via download: ${price:.2f}")
        else:
            print("❌ MSFT via download: No data")
    except Exception as e:
        print(f"❌ MSFT via download: Error - {str(e)}")

def test_portfolio_with_single_symbol():
    print("\n=== Testing Portfolio Calculator with Single Symbol ===")
    
    # Load portfolio and test with symbols that might be in cache
    portfolio = Portfolio.from_yaml(Path("playground/michael_test.yaml"))
    calculator = PortfolioCalculator(
        base_currency=portfolio.base_currency,
        exchange_rates=portfolio.exchange_rates,
        unit_prices=portfolio.unit_prices,
    )
    
    # Check what's already in cache
    print(f"Cached prices: {list(calculator.real_prices.keys())}")
    
    # Test with a cached symbol first
    for symbol in ["MSFT", "VTI", "GOOG", "TSLA", "SMH"]:
        if symbol in portfolio.securities:
            security = portfolio.securities[symbol]
            try:
                result = calculator.calc_holding_value(security, 1)
                print(f"✅ {symbol}: {result['unit_price']:.2f} {security.currency} (source: {result['price_source']})")
            except Exception as e:
                print(f"❌ {symbol}: Error - {str(e)}")

if __name__ == "__main__":
    test_individual_symbols()
    test_portfolio_with_single_symbol() 