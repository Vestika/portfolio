import asyncio
import httpx
from pymaya.maya import Maya
from abc import ABC, abstractmethod
from datetime import datetime
from loguru import logger
from typing import Optional, Literal, Any
from config import settings


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
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.timeout = 10.0
    
    def get_market_type(self) -> Literal["US", "TASE"]:
        return "US"
    
    async def fetch_price(self, symbol: str) -> Optional[dict[str, Any]]:
        """Fetch US stock price from Finnhub"""
        if not self.api_key:
            logger.error("Finnhub API key not configured")
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": symbol, "token": self.api_key},
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                current_price = data.get("c")
                
                if current_price is None or current_price == 0:
                    logger.warning(f"No price data available for symbol: {symbol}")
                    return None
                
                return {
                    "symbol": symbol,
                    "price": float(current_price),
                    "currency": "USD",  # Finnhub returns USD prices
                    "market": "US",
                    "source": "finnhub",
                    "fetched_at": datetime.utcnow(),
                    "date": datetime.utcnow().strftime("%Y-%m-%d"),
                    "previous_close": data.get("pc"),
                    "change": data.get("d"),
                    "change_percent": data.get("dp"),
                    "high": data.get("h"),
                    "low": data.get("l"),
                    "open": data.get("o")
                }
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching price for {symbol}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e}")
            return None

    async def get_market_status(self) -> dict[str, str]:
        """Check if the US market is open or closed using Finnhub API"""
        if not self.api_key:
            logger.error("Finnhub API key not configured")
            return {"us_market_status": "unknown"}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://finnhub.io/api/v1/stock/market-status",
                    params={"token": self.api_key, "exchange": "US"},
                    timeout=self.timeout
                )
                response.raise_for_status()
                data = response.json()
                # Finnhub returns 'isUSMarketOpen': true/false
                status = "open" if data.get("isOpen") else "closed"
                return {"us_market_status": status}
        except Exception as e:
            logger.error(f"Error fetching US market status: {e}")
            return {"us_market_status": "unknown"}

    async def get_company_profile(self, symbol: str) -> Optional[dict[str, Any]]:
        """Get company profile information including logo URL"""
        if not self.api_key:
            logger.error("Finnhub API key not configured")
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://finnhub.io/api/v1/stock/profile2",
                    params={"symbol": symbol, "token": self.api_key},
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                if data and isinstance(data, dict) and len(data) > 0:
                    logger.info(f"Successfully fetched company profile for {symbol}")
                    return data
                else:
                    logger.warning(f"No company profile found for symbol: {symbol}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error fetching company profile for {symbol}: {e}")
            return None

    async def get_company_logo(self, symbol: str) -> Optional[str]:
        """Get company logo URL for a given symbol"""
        profile = await self.get_company_profile(symbol)
        if profile and 'logo' in profile:
            return profile['logo']
        return None

    async def get_company_name(self, symbol: str) -> Optional[str]:
        """Get company name for a given symbol"""
        profile = await self.get_company_profile(symbol)
        if profile and 'name' in profile:
            return profile['name']
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
                    
                    # Create Maya instance and get detailed stock data including price
                    maya = Maya()
                    
                    # Get detailed information for the specific security (includes current price)
                    details = maya.get_details(str(symbol_int))
                    
                    if not details:
                        logger.warning(f"No details found for TASE symbol: {symbol}")
                        return None
                    
                    logger.debug(f"TASE details for {symbol}: {details}")
                    
                    # Different securities have different price fields
                    price = None
                    
                    # Try different price fields based on security type
                    if 'LastRate' in details and details['LastRate']:
                        # ETFs and stocks typically use LastRate
                        price = float(details['LastRate'])
                        price_field = 'LastRate'
                    elif 'UnitValuePrice' in details and details['UnitValuePrice']:
                        # Some funds use UnitValuePrice
                        price = float(details['UnitValuePrice'])
                        price_field = 'UnitValuePrice'
                    elif 'PurchasePrice' in details and details['PurchasePrice']:
                        # Some bonds/funds use PurchasePrice
                        price = float(details['PurchasePrice'])
                        price_field = 'PurchasePrice'
                    elif 'SellPrice' in details and details['SellPrice']:
                        # Fallback to SellPrice
                        price = float(details['SellPrice'])
                        price_field = 'SellPrice'
                    
                    if price is None or price == 0:
                        available_fields = [k for k, v in details.items() if v and 'price' in k.lower() or 'rate' in k.lower()]
                        logger.error(f"No valid price found for TASE symbol {symbol}. Available fields: {list(details.keys())[:10]}...")
                        logger.debug(f"Price-related fields: {available_fields}")
                        return None
                    
                    # Convert from agots to ILS (divide by 100) - as requested
                    price_ils = price / 100
                    
                    logger.info(f"TASE {symbol}: {price} agots -> {price_ils} ILS (using {price_field})")
                    
                    return {
                        "symbol": symbol,
                        "price": price_ils,  # Price in ILS
                        "currency": "ILS",
                        "market": "TASE",
                        "source": "maya",
                        "fetched_at": datetime.utcnow(),
                        "date": datetime.utcnow().strftime("%Y-%m-%d"),
                        "raw_price": price,  # Original price in agots
                        "price_field": price_field,  # Which field was used
                        "security_name": details.get("Name", "Unknown")
                    }
                    
                except ValueError as e:
                    logger.error(f"Invalid symbol format for TASE (must be numeric): {symbol}")
                    return None
                except Exception as e:
                    logger.error(f"Error fetching TASE price for {symbol}: {e}")
                    return None
            
            # Run in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, _fetch_sync)
            return result
            
        except Exception as e:
            logger.error(f"Error in async TASE fetch for {symbol}: {e}")
            return None
    
    async def get_market_status(self) -> dict[str, str]:
        """Check if the TASE market is open or closed based on local time"""
        try:
            # Run time check in a thread since it involves timezone calculations
            def _get_tase_status() -> str:
                from datetime import datetime, timezone
                import pytz
                
                # Get current time in Israel timezone
                israel_tz = pytz.timezone('Asia/Jerusalem')
                now_israel = datetime.now(israel_tz)
                
                # Check if it's a weekend (TASE is closed on weekends)
                # Sunday = 6, Monday = 0, ..., Saturday = 5
                weekday = now_israel.weekday()
                if weekday >= 5:  # Saturday (5) or Sunday (6)
                    return "closed"
                
                # Check trading hours (9:00 AM - 5:30 PM Israel time)
                current_time = now_israel.time()
                market_open = now_israel.replace(hour=9, minute=0, second=0, microsecond=0).time()
                market_close = now_israel.replace(hour=17, minute=30, second=0, microsecond=0).time()
                
                if market_open <= current_time <= market_close:
                    return "open"
                else:
                    return "closed"
            
            # Run in thread pool
            loop = asyncio.get_event_loop()
            status = await loop.run_in_executor(None, _get_tase_status)
            return {"tase_market_status": status}
            
        except Exception as e:
            logger.error(f"Error fetching TASE market status: {e}")
            return {"tase_market_status": "unknown"}


async def fetch_quotes(symbols: list[str]) -> dict[str, dict]:
    results = {}
    async with httpx.AsyncClient() as client:
        for symbol in symbols:
            try:
                resp = await client.get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": symbol, "token": settings.finnhub_api_key}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # Map Finnhub keys to more readable keys
                    results[symbol] = {
                        "current_price": data.get("c"),
                        "change": data.get("d"),
                        "percent_change": data.get("dp"),
                        "high": data.get("h"),
                        "low": data.get("l"),
                        "open": data.get("o"),
                        "previous_close": data.get("pc"),
                    }
                else:
                    results[symbol] = None
            except Exception:
                results[symbol] = None
    return results


def create_stock_fetcher(symbol: str) -> Optional[StockFetcher]:
    """
    Factory function to create appropriate fetcher based on symbol
    
    Args:
        symbol: Stock symbol to fetch
        
    Returns:
        Appropriate fetcher instance or None if symbol type not recognized
    """
    try:
        # Check if symbol is numeric (TASE)
        if symbol.isdigit():
            return TaseFetcher()
        else:
            # Assume US market for alphabetic symbols
            return FinnhubFetcher(settings.finnhub_api_key)
            
    except Exception as e:
        logger.error(f"Error creating fetcher for symbol {symbol}: {e}")
        return None


def detect_symbol_type(symbol: str) -> Literal["stock", "unknown"]:
    """
    Detect the type of symbol (stock only now that forex is separate)
    
    Args:
        symbol: Symbol to analyze
        
    Returns:
        Symbol type
    """
    if symbol.isdigit():
        return "stock"  # TASE stock
    elif symbol.isalpha() and len(symbol) <= 5:
        return "stock"  # US stock
    else:
        return "unknown" 