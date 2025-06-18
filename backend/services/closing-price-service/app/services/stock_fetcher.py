import asyncio
import httpx
import pymaya
from abc import ABC, abstractmethod
from datetime import datetime, date
from loguru import logger
from typing import Optional, Literal, Any

from ..config import settings


class StockFetcher(ABC):
    """Abstract base class for stock price fetchers"""
    
    @abstractmethod
    async def fetch_price(self, symbol: str) -> Optional[dict[str, Any]]:
        """Fetch stock price for a given symbol"""
        pass
    
    @abstractmethod
    def get_market_type(self) -> Literal["US", "TASE"]:
        """Get the market type this fetcher handles"""
        pass


class FinnhubFetcher(StockFetcher):
    """Fetcher for US stocks using Finnhub API"""
    
    def __init__(self) -> None:
        self.api_key = settings.finnhub_api_key
        self.base_url = settings.finnhub_base_url
        
    def get_market_type(self) -> Literal["US", "TASE"]:
        return "US"
    
    async def fetch_price(self, symbol: str) -> Optional[dict[str, Any]]:
        """Fetch US stock price from Finnhub"""
        if not self.api_key:
            logger.error("Finnhub API key not configured")
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                # Get current price
                price_response = await client.get(
                    f"{self.base_url}/quote",
                    params={"symbol": symbol, "token": self.api_key},
                    timeout=10.0
                )
                price_response.raise_for_status()
                price_data = price_response.json()
                
                if not price_data or price_data.get("c") is None:
                    logger.warning(f"No price data found for symbol {symbol}")
                    return None
                
                # Get company profile for additional info
                profile_response = await client.get(
                    f"{self.base_url}/stock/profile2",
                    params={"symbol": symbol, "token": self.api_key},
                    timeout=10.0
                )
                profile_data = {}
                if profile_response.status_code == 200:
                    profile_data = profile_response.json()
                
                return {
                    "symbol": symbol,
                    "price": float(price_data["c"]),  # Current price
                    "currency": profile_data.get("currency", "USD"),
                    "market": "US",
                    "date": date.today().isoformat(),
                    "fetched_at": datetime.utcnow()
                }
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching price for {symbol}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e}")
            return None


class TaseFetcher(StockFetcher):
    """Fetcher for TASE stocks using pymaya"""
    
    def get_market_type(self) -> Literal["US", "TASE"]:
        return "TASE"
    
    async def fetch_price(self, symbol: str) -> Optional[dict[str, Any]]:
        """Fetch TASE stock price using pymaya"""
        try:
            # Run pymaya in a thread since it's not async
            def _fetch_sync() -> Optional[dict[str, Any]]:
                try:
                    # Convert symbol to integer for TASE
                    symbol_int = int(symbol)
                    
                    # Get stock data using pymaya
                    stock_data = pymaya.get_stock_data(symbol_int)
                    
                    if not stock_data or not stock_data.get("LastPrice"):
                        logger.warning(f"No price data found for TASE symbol {symbol}")
                        return None
                    
                    return {
                        "symbol": symbol,
                        "price": float(stock_data["LastPrice"]),
                        "currency": "ILS",
                        "market": "TASE",
                        "date": date.today().isoformat(),
                        "fetched_at": datetime.utcnow()
                    }
                    
                except ValueError:
                    logger.error(f"Invalid TASE symbol format: {symbol} (must be numeric)")
                    return None
                except Exception as e:
                    logger.error(f"Error fetching TASE price for {symbol}: {e}")
                    return None
            
            # Run in thread pool to avoid blocking
            return await asyncio.get_event_loop().run_in_executor(None, _fetch_sync)
            
        except Exception as e:
            logger.error(f"Error in TASE fetcher for {symbol}: {e}")
            return None


class StockFetcherFactory:
    """Factory to create appropriate stock fetcher based on symbol"""
    
    @staticmethod
    def create_fetcher(symbol: str) -> StockFetcher:
        """Create appropriate fetcher based on symbol format"""
        # If symbol is numeric, assume it's TASE
        if symbol.isdigit():
            return TaseFetcher()
        else:
            return FinnhubFetcher()
    
    @staticmethod
    def get_market_type(symbol: str) -> Literal["US", "TASE"]:
        """Determine market type based on symbol format"""
        return "TASE" if symbol.isdigit() else "US" 