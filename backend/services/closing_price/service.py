import asyncio
import concurrent.futures
from typing import Optional, Dict, Any
from loguru import logger

from .price_manager import PriceManager
from .currency_service import currency_service
from .database import connect_to_mongo, connect_to_redis, close_mongo_connection, close_redis_connection


class ClosingPriceService:
    """Simplified closing price service for direct use"""
    
    def __init__(self):
        self.price_manager: Optional[PriceManager] = None
        self._initialized = False
        self._initialization_lock = asyncio.Lock()
        self._event_loop = None
        self._thread_pool = None
    
    async def initialize(self) -> None:
        """Initialize the service (connect to databases, etc.)"""
        if self._initialized:
            return
            
        async with self._initialization_lock:
            if self._initialized:
                return
                
            try:
                logger.info("Initializing closing price service...")
                
                # Connect to databases
                await connect_to_mongo()
                await connect_to_redis()
                
                # Initialize price manager
                self.price_manager = PriceManager()
                
                self._initialized = True
                logger.info("Closing price service initialized successfully")
                
            except Exception as e:
                logger.error(f"Failed to initialize closing price service: {e}")
                raise
    
    async def _ensure_initialized(self):
        """Ensure the service is initialized"""
        if not self._initialized:
            await self.initialize()
    
    async def get_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest closing price for a symbol.
        
        Args:
            symbol: Stock symbol (e.g., 'AAPL', 'MSFT', '1101534')
            
        Returns:
            Dictionary with price data or None if not found
        """
        try:
            await self._ensure_initialized()
            
            price_response = await self.price_manager.get_price(symbol.upper())
            if price_response:
                return price_response.dict()
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
            await self._ensure_initialized()
            
            rate = await currency_service.get_exchange_rate(from_currency, to_currency)
            return rate
            
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
            await self._ensure_initialized()
            
            info = await currency_service.get_currency_info(from_currency, to_currency)
            return info
            
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
            await self._ensure_initialized()
            
            currencies = await currency_service.get_supported_currencies()
            return currencies
            
        except Exception as e:
            logger.error(f"Error getting supported currencies: {e}")
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
            await self._ensure_initialized()
            
            results = await self.price_manager.track_symbols(symbols)
            return results
            
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
            await self._ensure_initialized()
            
            results = await self.price_manager.refresh_tracked_symbols()
            return results
            
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
            await self._ensure_initialized()
            
            # Check if we can get a simple operation to work
            return self.price_manager is not None and self._initialized
            
        except Exception as e:
            logger.warning(f"Health check failed: {e}")
            return False
    
    def _run_async_operation(self, coro):
        """
        Run an async operation, handling event loop creation and cleanup properly
        """
        try:
            # Check if there's already a running event loop
            try:
                loop = asyncio.get_running_loop()
                # If we're already in an event loop, run in a thread pool with its own event loop
                def run_in_new_loop():
                    # Create a new event loop for this thread
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        # Reset initialization state for this new loop
                        self._initialized = False
                        result = new_loop.run_until_complete(coro)
                        return result
                    finally:
                        # Clean up connections before closing loop
                        try:
                            new_loop.run_until_complete(self.cleanup())
                        except Exception as e:
                            logger.warning(f"Error during cleanup in thread: {e}")
                        new_loop.close()
                
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(run_in_new_loop)
                    return future.result(timeout=30)
                    
            except RuntimeError:
                # No running event loop, we can create our own
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(coro)
                    return result
                finally:
                    # Clean up connections before closing loop
                    try:
                        loop.run_until_complete(self.cleanup())
                    except Exception as e:
                        logger.warning(f"Error during cleanup: {e}")
                    loop.close()
                    
        except Exception as e:
            logger.error(f"Error in async operation: {e}")
            return None
    
    # Synchronous wrapper methods
    def get_price_sync(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Synchronous wrapper for get_price"""
        return self._run_async_operation(self.get_price(symbol))
    
    def get_exchange_rate_sync(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Synchronous wrapper for get_exchange_rate"""
        return self._run_async_operation(self.get_exchange_rate(from_currency, to_currency))
    
    def get_exchange_rate_info_sync(self, from_currency: str, to_currency: str) -> Optional[Dict[str, Any]]:
        """Synchronous wrapper for get_exchange_rate_info"""
        return self._run_async_operation(self.get_exchange_rate_info(from_currency, to_currency))
    
    def get_supported_currencies_sync(self) -> Optional[list[str]]:
        """Synchronous wrapper for get_supported_currencies"""
        return self._run_async_operation(self.get_supported_currencies())

    def refresh_prices_sync(self) -> Optional[Dict[str, Any]]:
        """Synchronous wrapper for refresh_prices"""
        return self._run_async_operation(self.refresh_prices())
    
    def health_check_sync(self) -> bool:
        """Synchronous wrapper for health_check"""
        result = self._run_async_operation(self.health_check())
        return result if result is not None else False
    
    async def get_historical_prices(
        self, 
        symbols: list[str], 
        days: int = 7
    ) -> Optional[Dict[str, list[Dict[str, Any]]]]:
        """
        Get historical prices for multiple symbols from MongoDB (FAST!).
        
        Args:
            symbols: List of symbols to fetch
            days: Number of days of history (default: 7)
            
        Returns:
            Dictionary mapping symbol to list of historical price points
        """
        try:
            await self._ensure_initialized()
            
            result = await self.price_manager.get_historical_prices(symbols, days)
            return result
            
        except Exception as e:
            logger.error(f"Error getting historical prices: {e}")
            return None
    
    async def cleanup(self):
        """Clean up resources when shutting down"""
        try:
            if self._initialized:
                logger.debug("Cleaning up closing price service...")
                await close_redis_connection()
                await close_mongo_connection()
                self._initialized = False
                logger.debug("Closing price service cleaned up successfully")
        except Exception as e:
            logger.warning(f"Error during cleanup: {e}")


# Global service instance for better connection management in FastAPI
_global_service: Optional[ClosingPriceService] = None

def get_global_service() -> ClosingPriceService:
    """Get or create the global service instance"""
    global _global_service
    if _global_service is None:
        _global_service = ClosingPriceService()
    return _global_service 