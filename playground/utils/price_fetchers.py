"""
Price fetching utilities with multiple providers for reliability.
Supports Alpha Vantage (primary) and Yahoo Finance (fallback).
"""

import os
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple
import yfinance as yf
from alpha_vantage.timeseries import TimeSeries
from alpha_vantage.fundamentaldata import FundamentalData
import logging

logger = logging.getLogger(__name__)


class PriceFetcher(ABC):
    """Abstract base class for price fetchers."""
    
    @abstractmethod
    def fetch_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Fetch current prices for given symbols."""
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """Get the name of this price fetcher."""
        pass


class AlphaVantageFetcher(PriceFetcher):
    """Alpha Vantage price fetcher - more reliable than Yahoo Finance."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('ALPHA_VANTAGE_API_KEY')
        if not self.api_key:
            raise ValueError(
                "Alpha Vantage API key required. Set ALPHA_VANTAGE_API_KEY environment variable "
                "or get a free key from https://www.alphavantage.co/support/#api-key"
            )
        
        self.ts = TimeSeries(key=self.api_key, output_format='pandas')
        self.fundamentals = FundamentalData(key=self.api_key, output_format='pandas')
    
    def fetch_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Fetch current prices using Alpha Vantage API with optimized rate limiting."""
        prices = {}
        
        if not symbols:
            return prices
            
        print(f"🔄 Alpha Vantage: Fetching {len(symbols)} symbols (rate limited)...")
        
        for i, symbol in enumerate(symbols, 1):
            try:
                print(f"  [{i}/{len(symbols)}] Fetching {symbol}...", end=" ", flush=True)
                
                # Try different data sources based on availability
                data = None
                
                # First try intraday data (most current)
                try:
                    data, meta_data = self.ts.get_intraday(symbol=symbol, interval='1min', outputsize='compact')
                except Exception as e:
                    print(f"\n    📋 Full intraday error: {str(e)}")
                    error_msg = str(e).lower()
                    if "premium" in error_msg or "api key" in error_msg:
                        print(f"    ⚠️  Premium only")
                        continue
                    # If intraday fails, try daily data
                    try:
                        data, meta_data = self.ts.get_daily(symbol=symbol, outputsize='compact')
                    except Exception as e2:
                        print(f"    📋 Full daily error: {str(e2)}")
                        error_msg2 = str(e2).lower()
                        if "premium" in error_msg2 or "api key" in error_msg2:
                            print(f"    ⚠️  Premium only")
                            continue
                        # If daily fails, try quote endpoint
                        try:
                            data, meta_data = self.ts.get_quote_endpoint(symbol=symbol)
                        except Exception as e3:
                            print(f"    📋 Full quote error: {str(e3)}")
                            error_msg3 = str(e3).lower()
                            if "premium" in error_msg3 or "api key" in error_msg3:
                                print(f"    ⚠️  Premium only")
                            else:
                                print(f"    ❌ All endpoints failed")
                            continue
                
                if data is not None and not data.empty:
                    # Extract price based on data type
                    if '4. close' in data.columns:
                        latest_price = data['4. close'].iloc[0]
                    elif '05. price' in data.columns:  # Quote endpoint
                        latest_price = data['05. price'].iloc[0]
                    else:
                        # Try to find any price column
                        price_columns = [col for col in data.columns if 'price' in col.lower() or 'close' in col.lower()]
                        if price_columns:
                            latest_price = data[price_columns[0]].iloc[0]
                        else:
                            print("❌ No price data found")
                            continue
                    
                    prices[symbol] = float(latest_price)
                    print(f"✅ ${latest_price:.2f}")
                else:
                    print("❌ No data returned")
                
                # Rate limiting - Alpha Vantage free tier allows 25 requests per day, 5 per minute
                if i < len(symbols):  # Don't wait after the last symbol
                    print(f"    ⏳ Waiting 12s for rate limit...")
                    time.sleep(12)  # 12 seconds between requests = 5 per minute max
                    
            except Exception as e:
                print(f"\n    📋 Full outer error: {str(e)}")
                error_msg = str(e).lower()
                if "premium" in error_msg or "api key" in error_msg:
                    print(f"    ⚠️  Premium only")
                else:
                    print(f"    ❌ Unexpected error")
                continue
        
        return prices
    
    def get_name(self) -> str:
        return "Alpha Vantage"


class YahooFinanceFetcher(PriceFetcher):
    """Yahoo Finance fetcher - kept as fallback."""
    
    def fetch_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Fetch prices using Yahoo Finance (original implementation)."""
        prices = {}
        
        if not symbols:
            return prices
        
        print(f"🔄 Yahoo Finance: Attempting bulk fetch of {len(symbols)} symbols...")
        
        try:
            # Try bulk download first
            data = yf.download(symbols, period="5d", group_by="ticker", rounding=True, progress=False)
            if data.empty:
                return prices
            
            def get_last_valid_close(data, symbol):
                if symbol in data and not data[symbol].empty:
                    return float(data[symbol]["Close"].dropna().iloc[-1])
                return None
            
            for symbol in symbols:
                if last_close := get_last_valid_close(data, symbol):
                    prices[symbol] = last_close
                    print(f"  ✅ {symbol}: ${last_close:.2f}")
                    
        except Exception as e:
            logger.error(f"Yahoo Finance bulk download failed: {str(e)}")
        
        return prices
    
    def get_name(self) -> str:
        return "Yahoo Finance"


class MultiProviderPriceFetcher:
    """
    Multi-provider price fetcher that tries Alpha Vantage first, then Yahoo Finance.
    """
    
    def __init__(self, alpha_vantage_api_key: Optional[str] = None):
        self.providers = []
        
        # Try to initialize Alpha Vantage
        try:
            av_fetcher = AlphaVantageFetcher(alpha_vantage_api_key)
            self.providers.append(av_fetcher)
            logger.info("✅ Alpha Vantage fetcher initialized")
        except Exception as e:
            logger.warning(f"❌ Alpha Vantage fetcher failed to initialize: {str(e)}")
        
        # Always add Yahoo Finance as fallback
        self.providers.append(YahooFinanceFetcher())
        logger.info("✅ Yahoo Finance fetcher added as fallback")
    
    def fetch_prices(self, symbols: List[str]) -> Tuple[Dict[str, float], str]:
        """
        Fetch prices using available providers.
        Returns (prices_dict, provider_name).
        """
        if not symbols:
            return {}, "None"
            
        for provider in self.providers:
            try:
                print(f"🚀 Trying {provider.get_name()}...")
                prices = provider.fetch_prices(symbols)
                
                if prices:  # If we got any prices
                    success_rate = len(prices) / len(symbols) * 100
                    print(f"✅ {provider.get_name()}: {len(prices)}/{len(symbols)} symbols ({success_rate:.1f}% success)")
                    return prices, provider.get_name()
                else:
                    print(f"❌ {provider.get_name()}: No prices returned")
                    
            except Exception as e:
                print(f"❌ {provider.get_name()}: {str(e)}")
                continue
        
        print("❌ All price providers failed")
        return {}, "None"


def get_price_fetcher(alpha_vantage_api_key: Optional[str] = None) -> MultiProviderPriceFetcher:
    """Get a configured multi-provider price fetcher."""
    return MultiProviderPriceFetcher(alpha_vantage_api_key) 