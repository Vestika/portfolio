"""
In-Memory Live Price Cache

This module provides a simple, thread-safe in-memory cache for live stock prices.
The cache is updated by a background service every 15 minutes and is used to:
1. Serve current prices to the frontend quickly
2. Transfer prices to MongoDB historical collection every 3 hours

This is separate from Redis cache - this is specifically for live prices during trading hours.
"""
import threading
from datetime import datetime
from typing import Dict, Optional, Any
from loguru import logger


class LivePriceCache:
    """Thread-safe in-memory cache for live prices"""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()  # Reentrant lock for thread safety
    
    def get(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get live price for a symbol from cache.
        
        Returns:
            Dictionary with keys: price, last_update, currency, market
            None if symbol not in cache
        """
        with self._lock:
            return self._cache.get(symbol)
    
    def set(self, symbol: str, price: float, currency: str = "USD", market: str = "US", **kwargs) -> None:
        """
        Set live price for a symbol in cache.
        
        Args:
            symbol: Stock symbol
            price: Current price
            currency: Price currency (default: USD)
            market: Market type (US, TASE, CURRENCY, CRYPTO)
            **kwargs: Additional metadata (change_percent, volume, etc.)
        """
        with self._lock:
            self._cache[symbol] = {
                "price": price,
                "last_update": datetime.utcnow(),
                "currency": currency,
                "market": market,
                **kwargs
            }
    
    def get_all(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all cached prices (copy to prevent external modification).
        
        Returns:
            Dictionary of all cached prices
        """
        with self._lock:
            return dict(self._cache)
    
    def get_symbols(self) -> list[str]:
        """
        Get list of all symbols currently in cache.
        
        Returns:
            List of symbol strings
        """
        with self._lock:
            return list(self._cache.keys())
    
    def clear(self) -> None:
        """Clear all cached prices"""
        with self._lock:
            self._cache.clear()
            logger.info("[LIVE CACHE] Cleared all cached prices")
    
    def remove(self, symbol: str) -> bool:
        """
        Remove a symbol from cache.
        
        Returns:
            True if symbol was removed, False if it wasn't in cache
        """
        with self._lock:
            if symbol in self._cache:
                del self._cache[symbol]
                return True
            return False
    
    def size(self) -> int:
        """
        Get number of symbols currently in cache.
        
        Returns:
            Number of cached symbols
        """
        with self._lock:
            return len(self._cache)
    
    def update_batch(self, prices: list[Dict[str, Any]]) -> int:
        """
        Update multiple prices at once (more efficient than individual updates).
        
        Args:
            prices: List of dicts with keys: symbol, price, currency, market
        
        Returns:
            Number of prices updated
        """
        with self._lock:
            count = 0
            for price_data in prices:
                symbol = price_data.get("symbol")
                price = price_data.get("price")
                
                if symbol and price is not None:
                    self._cache[symbol] = {
                        "price": price,
                        "last_update": datetime.utcnow(),
                        "currency": price_data.get("currency", "USD"),
                        "market": price_data.get("market", "US"),
                        "change_percent": price_data.get("change_percent"),
                        "change": price_data.get("change"),
                        "previous_close": price_data.get("previous_close"),
                    }
                    count += 1
            
            return count
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        with self._lock:
            if not self._cache:
                return {
                    "total_symbols": 0,
                    "markets": {},
                    "oldest_update": None,
                    "newest_update": None
                }
            
            # Calculate stats
            markets = {}
            oldest_update = None
            newest_update = None
            
            for data in self._cache.values():
                market = data.get("market", "unknown")
                markets[market] = markets.get(market, 0) + 1
                
                last_update = data.get("last_update")
                if last_update:
                    if oldest_update is None or last_update < oldest_update:
                        oldest_update = last_update
                    if newest_update is None or last_update > newest_update:
                        newest_update = last_update
            
            return {
                "total_symbols": len(self._cache),
                "markets": markets,
                "oldest_update": oldest_update.isoformat() if oldest_update else None,
                "newest_update": newest_update.isoformat() if newest_update else None
            }


# Global singleton instance
_live_price_cache: Optional[LivePriceCache] = None
_cache_lock = threading.Lock()


def get_live_price_cache() -> LivePriceCache:
    """
    Get the global live price cache instance (thread-safe singleton).
    
    Returns:
        LivePriceCache singleton instance
    """
    global _live_price_cache
    
    if _live_price_cache is None:
        with _cache_lock:
            # Double-check locking pattern
            if _live_price_cache is None:
                _live_price_cache = LivePriceCache()
                logger.info("[LIVE CACHE] Initialized global live price cache")
    
    return _live_price_cache


# Convenience functions for common operations
def get_live_price(symbol: str) -> Optional[Dict[str, Any]]:
    """Get live price for a symbol"""
    return get_live_price_cache().get(symbol)


def set_live_price(symbol: str, price: float, **kwargs) -> None:
    """Set live price for a symbol"""
    get_live_price_cache().set(symbol, price, **kwargs)


def get_all_live_prices() -> Dict[str, Dict[str, Any]]:
    """Get all cached live prices"""
    return get_live_price_cache().get_all()


def get_cached_symbols() -> list[str]:
    """Get list of all cached symbols"""
    return get_live_price_cache().get_symbols()

