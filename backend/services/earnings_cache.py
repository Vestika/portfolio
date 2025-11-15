"""
Earnings Data Caching Service

Similar to historical price caching, this service:
1. Fetches earnings data from Finnhub periodically (background job)
2. Stores in MongoDB with TTL
3. Serves from cache on portfolio load (no API calls!)
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from loguru import logger

from core.database import db_manager
from services.earnings.service import get_earnings_service


class EarningsCacheService:
    """Service for caching earnings data"""
    
    def __init__(self):
        self.earnings_service = get_earnings_service()
    
    async def sync_earnings_for_symbols(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch and cache earnings data for a list of symbols.
        
        This is called by the scheduler every 24 hours to refresh earnings data.
        
        Args:
            symbols: List of stock/ETF symbols
        
        Returns:
            Dictionary with sync statistics
        """
        logger.info(f"[EARNINGS CACHE] Starting earnings sync for {len(symbols)} symbols")
        
        try:
            # Ensure database connection
            if not hasattr(db_manager, '_database') or db_manager._database is None:
                await db_manager.connect("vestika")
            
            collection = db_manager.get_collection("earnings_cache")
            
            success_count = 0
            error_count = 0
            
            # Fetch earnings for all symbols
            earnings_data = await self.earnings_service.get_earnings_calendar(symbols)
            
            # Store in MongoDB with timestamp
            now = datetime.utcnow()
            
            for symbol, raw_earnings in earnings_data.items():
                try:
                    # Format the earnings data
                    formatted_earnings = self.earnings_service.format_earnings_data(raw_earnings)
                    
                    # Upsert to cache
                    await collection.update_one(
                        {"symbol": symbol},
                        {
                            "$set": {
                                "symbol": symbol,
                                "earnings": formatted_earnings,
                                "cached_at": now,
                                "expires_at": now + timedelta(hours=24)
                            }
                        },
                        upsert=True
                    )
                    
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"[EARNINGS CACHE] Error caching earnings for {symbol}: {e}")
                    error_count += 1
            
            logger.info(f"[EARNINGS CACHE] Sync completed: {success_count} success, {error_count} errors")
            
            return {
                "success_count": success_count,
                "error_count": error_count,
                "total": len(symbols)
            }
            
        except Exception as e:
            logger.error(f"[EARNINGS CACHE] Error during earnings sync: {e}")
            return {
                "success_count": 0,
                "error_count": len(symbols),
                "total": len(symbols),
                "error": str(e)
            }
    
    async def get_cached_earnings(self, symbols: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get earnings data from cache (no API calls!).
        
        Args:
            symbols: List of symbols to get earnings for
        
        Returns:
            Dictionary mapping symbol to earnings data
        """
        try:
            # Ensure database connection
            if not hasattr(db_manager, '_database') or db_manager._database is None:
                await db_manager.connect("vestika")
            
            collection = db_manager.get_collection("earnings_cache")
            
            # Get cached earnings for all symbols at once
            now = datetime.utcnow()
            cursor = collection.find({
                "symbol": {"$in": symbols},
                "expires_at": {"$gt": now}  # Not expired
            })
            
            result = {}
            async for doc in cursor:
                symbol = doc.get("symbol")
                earnings = doc.get("earnings", [])
                if symbol:
                    result[symbol] = earnings
            
            logger.info(f"[EARNINGS CACHE] Retrieved cached earnings for {len(result)}/{len(symbols)} symbols")
            
            return result
            
        except Exception as e:
            logger.error(f"[EARNINGS CACHE] Error getting cached earnings: {e}")
            return {}
    
    async def sync_earnings_for_tracked_stocks(self) -> Dict[str, Any]:
        """
        Sync earnings for all tracked stock/ETF symbols.
        
        This is called by the scheduler to refresh earnings data.
        
        Returns:
            Dictionary with sync statistics
        """
        logger.info("[EARNINGS CACHE] Syncing earnings for tracked stocks")
        
        try:
            # Ensure database connection
            if not hasattr(db_manager, '_database') or db_manager._database is None:
                await db_manager.connect("vestika")
            
            # Get all tracked symbols
            from services.closing_price.database import db, ensure_connections
            await ensure_connections()
            
            tracked_symbols = await db.database.tracked_symbols.find({}).to_list(length=None)
            
            # Filter to stock/ETF symbols only (US market)
            stock_symbols = [
                doc["symbol"] for doc in tracked_symbols
                if doc.get("market") == "US" and not doc["symbol"].startswith("FX:")
            ]
            
            logger.info(f"[EARNINGS CACHE] Found {len(stock_symbols)} stock/ETF symbols to sync")
            
            if not stock_symbols:
                return {"success_count": 0, "error_count": 0, "total": 0}
            
            # Sync earnings
            result = await self.sync_earnings_for_symbols(stock_symbols)
            
            return result
            
        except Exception as e:
            logger.error(f"[EARNINGS CACHE] Error syncing earnings for tracked stocks: {e}")
            return {"success_count": 0, "error_count": 0, "total": 0, "error": str(e)}


# Global singleton
_earnings_cache_service: Optional[EarningsCacheService] = None


def get_earnings_cache_service() -> EarningsCacheService:
    """Get the global earnings cache service instance"""
    global _earnings_cache_service
    if _earnings_cache_service is None:
        _earnings_cache_service = EarningsCacheService()
        logger.info("[EARNINGS CACHE] Initialized earnings cache service")
    return _earnings_cache_service

