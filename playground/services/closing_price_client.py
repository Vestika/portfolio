import httpx
import asyncio
import concurrent.futures
from typing import Optional, Dict, Any
from loguru import logger


class ClosingPriceClient:
    """Client for the closing price service API"""
    
    def __init__(self, base_url: str = "http://localhost:8001/api/v1"):
        self.base_url = base_url
        self.timeout = 10.0
    
    async def get_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest closing price for a symbol.
        
        Args:
            symbol: Stock symbol (e.g., 'AAPL', 'MSFT', '1101534')
            
        Returns:
            Dictionary with price data or None if not found
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/prices/{symbol}",
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
                
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"Price not found for symbol: {symbol}")
            else:
                logger.error(f"HTTP error getting price for {symbol}: {e}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request error getting price for {symbol}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {e}")
            return None
    
    async def get_exchange_rate(self, from_currency: str, to_currency: str) -> Optional[float]:
        """
        Get the latest exchange rate between two currencies.
        
        Args:
            from_currency: Source currency (e.g., 'USD')
            to_currency: Target currency (e.g., 'ILS')
            
        Returns:
            Exchange rate as float or None if not found
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/currency/{from_currency}/{to_currency}",
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                return data.get("rate")
                
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"Exchange rate not found for {from_currency}/{to_currency}")
            else:
                logger.error(f"HTTP error getting exchange rate for {from_currency}/{to_currency}: {e}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request error getting exchange rate for {from_currency}/{to_currency}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting exchange rate for {from_currency}/{to_currency}: {e}")
            return None
    
    async def get_exchange_rate_info(self, from_currency: str, to_currency: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed exchange rate information including timestamp and source.
        
        Args:
            from_currency: Source currency (e.g., 'USD')
            to_currency: Target currency (e.g., 'ILS')
            
        Returns:
            Dictionary with detailed rate info or None if not found
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/currency/{from_currency}/{to_currency}/info",
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
                
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"Exchange rate info not found for {from_currency}/{to_currency}")
            else:
                logger.error(f"HTTP error getting exchange rate info for {from_currency}/{to_currency}: {e}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request error getting exchange rate info for {from_currency}/{to_currency}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting exchange rate info for {from_currency}/{to_currency}: {e}")
            return None
    
    async def get_supported_currencies(self) -> Optional[list[str]]:
        """
        Get list of supported currencies.
        
        Returns:
            List of currency codes or None if failed
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/currency/supported",
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                return data.get("currencies")
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting supported currencies: {e}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request error getting supported currencies: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting supported currencies: {e}")
            return None
    
    def get_price_sync(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Synchronous wrapper for get_price"""
        try:
            # Check if there's already a running event loop
            try:
                loop = asyncio.get_running_loop()
                # If we're already in an event loop, run in a thread pool
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.get_price(symbol))
                    return future.result(timeout=self.timeout + 5)
            except RuntimeError:
                # No running event loop, we can use asyncio.run
                return asyncio.run(self.get_price(symbol))
        except Exception as e:
            logger.error(f"Error in sync price fetch for {symbol}: {e}")
            return None
    
    def get_exchange_rate_sync(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Synchronous wrapper for get_exchange_rate"""
        try:
            # Check if there's already a running event loop
            try:
                loop = asyncio.get_running_loop()
                # If we're already in an event loop, run in a thread pool
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.get_exchange_rate(from_currency, to_currency))
                    return future.result(timeout=self.timeout + 5)
            except RuntimeError:
                # No running event loop, we can use asyncio.run
                return asyncio.run(self.get_exchange_rate(from_currency, to_currency))
        except Exception as e:
            logger.error(f"Error in sync exchange rate fetch for {from_currency}/{to_currency}: {e}")
            return None
    
    async def track_symbols(self, symbols: list[str]) -> Optional[Dict[str, str]]:
        """
        Add symbols to the tracking list.
        
        Args:
            symbols: List of symbols to track
            
        Returns:
            Dictionary with tracking results or None if error
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/prices",
                    json={"symbols": symbols},
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.warning(f"HTTP error tracking symbols {symbols}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error tracking symbols {symbols}: {e}")
            return None
    
    async def refresh_prices(self) -> Optional[Dict[str, Any]]:
        """
        Manually refresh all tracked symbols.
        
        Returns:
            Dictionary with refresh results or None if error
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/prices/refresh",
                    timeout=30.0  # Longer timeout for refresh
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.warning(f"HTTP error refreshing prices: {e}")
            return None
        except Exception as e:
            logger.error(f"Error refreshing prices: {e}")
            return None
    
    async def health_check(self) -> bool:
        """
        Check if the closing price service is healthy.
        
        Returns:
            True if service is healthy, False otherwise
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/health",
                    timeout=5.0
                )
                response.raise_for_status()
                data = response.json()
                return data.get("status") == "healthy"
        except Exception as e:
            logger.warning(f"Health check failed: {e}")
            return False 