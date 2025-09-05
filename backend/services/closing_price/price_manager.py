import json
from datetime import datetime, timedelta
from loguru import logger
from typing import Optional, Any
import asyncio

from config import settings
from .stock_fetcher import create_stock_fetcher, detect_symbol_type
from .database import db, cache
from .models import StockPrice, TrackedSymbol, PriceResponse


class PriceManager:
    """Manages stock price fetching, caching, and tracking"""
    
    async def get_price(self, symbol: str) -> Optional[PriceResponse]:
        """Get the latest price for a symbol, with lazy fetching and caching"""
        try:
            # First check Redis cache
            cached_price = await self._get_cached_price(symbol)
            if cached_price:
                logger.info(f"Retrieved cached price for {symbol}")
                await self._update_tracking(symbol)
                return cached_price
            
            # Check MongoDB for recent price
            db_price = None and await self._get_db_price(symbol)
            if db_price and self._is_price_fresh(db_price.fetched_at):
                logger.info(f"Retrieved fresh price from DB for {symbol}")
                await self._cache_price(db_price)
                await self._update_tracking(symbol)
                return self._to_price_response(db_price)
            
            # Fetch fresh price
            logger.info(f"Fetching fresh price for {symbol}")
            fresh_price = await self._fetch_and_store_price(symbol)
            if fresh_price:
                await self._update_tracking(symbol)
                return fresh_price
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {e}")
            return None

    async def get_logo(self, symbol: str) -> str | None:
        """Get company logo URL using the logo cache service"""
        try:
            from core.logo_cache_service import LogoCacheService
            cache_service = LogoCacheService()
            return await cache_service.get_logo(symbol)
        except Exception as e:
            logger.error(f"Error getting logo for {symbol}: {e}")
            return None
    
    async def get_tracked_prices(self) -> list[PriceResponse]:
        """Get latest prices for all tracked symbols"""
        try:
            tracked_symbols = await self._get_tracked_symbols()
            prices = []
            
            for symbol_doc in tracked_symbols:
                symbol = symbol_doc["symbol"]
                price = await self.get_price(symbol)
                if price:
                    prices.append(price)
            
            return prices
            
        except Exception as e:
            logger.error(f"Error getting tracked prices: {e}")
            return []

    async def get_prices_for_list(self, symbols: list[str]) -> dict[str, dict | None]:
        """Get latest prices for a list of symbols using internal caching/fetching.

        Returns a mapping symbol -> { current_price, change, percent_change, high, low, open, previous_close }
        Matching the format of fetch_quotes in stock_fetcher for compatibility. Unknown fields are None.
        """
        results: dict[str, dict | None] = {}

        async def fetch_one(sym: str):
            try:
                price = await self.get_price(sym)
                if price is None:
                    results[sym] = None
                    return
                results[sym] = {
                    "current_price": price.price,
                    "change": None,
                    "percent_change": price.percent_change,
                    "high": None,
                    "low": None,
                    "open": None,
                    "previous_close": None,
                }
            except Exception as e:
                logger.error(f"Error getting price for {sym}: {e}")
                results[sym] = None

        # Normalize symbols to uppercase for consistency
        norm_symbols = [s.strip().upper() for s in symbols if s and s.strip()]
        await asyncio.gather(*(fetch_one(s) for s in norm_symbols))
        return results
    
    async def track_symbols(self, symbols: list[str]) -> dict[str, str]:
        """Add symbols to tracking list"""
        results = {}
        
        for symbol in symbols:
            try:
                # Detect symbol type and determine market
                symbol_type = detect_symbol_type(symbol)
                if symbol_type == "unknown":
                    results[symbol] = "unsupported_symbol_type"
                    continue
                
                market_type = "TASE" if symbol.isdigit() else "US"
                
                # Check if already tracked
                existing = await db.database.tracked_symbols.find_one({"symbol": symbol})
                if existing:
                    results[symbol] = "already_tracked"
                    continue
                
                # Add to tracking
                tracked_symbol = TrackedSymbol(
                    symbol=symbol,
                    market=market_type,
                    added_at=datetime.utcnow(),
                    last_queried_at=datetime.utcnow()
                )
                
                await db.database.tracked_symbols.insert_one(tracked_symbol.dict(by_alias=True))
                results[symbol] = "added"
                logger.info(f"Added {symbol} to tracking list")
                
            except Exception as e:
                logger.error(f"Error tracking symbol {symbol}: {e}")
                results[symbol] = f"error: {str(e)}"
        
        return results
    
    async def refresh_tracked_symbols(self) -> dict[str, Any]:
        """Refresh prices for all tracked symbols"""
        try:
            tracked_symbols = await self._get_tracked_symbols()
            refreshed_count = 0
            not_refreshed_count = 0
            failed_symbols = []
            
            for symbol_doc in tracked_symbols:
                symbol = symbol_doc["symbol"]
                try:
                    price = await self._fetch_and_store_price(symbol)
                    if price:
                        refreshed_count += 1
                    else:
                        # No new data available (market closed, not traded, etc.)
                        not_refreshed_count += 1
                except Exception as e:
                    logger.error(f"Error refreshing {symbol}: {e}")
                    failed_symbols.append(symbol)
            
            # Clean up old tracking records
            await self._cleanup_old_tracked_symbols()
            
            total_symbols = len(tracked_symbols)
            message = f"Refreshed {refreshed_count} symbols"
            if not_refreshed_count > 0:
                message += f", {not_refreshed_count} not refreshed (no new data)"
            if failed_symbols:
                message += f", {len(failed_symbols)} failed"
            
            return {
                "message": message,
                "refreshed_count": refreshed_count,
                "not_refreshed_count": not_refreshed_count,
                "failed_symbols": failed_symbols
            }
            
        except Exception as e:
            logger.error(f"Error refreshing tracked symbols: {e}")
            return {
                "message": f"Error during refresh: {str(e)}",
                "refreshed_count": 0,
                "not_refreshed_count": 0,
                "failed_symbols": []
            }
    
    async def get_us_market_status(self) -> dict[str, str]:
        """Get US market open/closed status from FinnhubFetcher"""
        from .stock_fetcher import FinnhubFetcher
        fetcher = FinnhubFetcher(settings.finnhub_api_key)
        return await fetcher.get_market_status()
    
    async def get_market_status(self) -> dict[str, str]:
        """Get both US and TASE market statuses"""
        from .stock_fetcher import FinnhubFetcher, TaseFetcher
        
        # Get US market status
        us_fetcher = FinnhubFetcher(settings.finnhub_api_key)
        us_status = await us_fetcher.get_market_status()
        
        # Get TASE market status
        tase_fetcher = TaseFetcher()
        tase_status = await tase_fetcher.get_market_status()
        
        # Combine both statuses
        return {**us_status, **tase_status}
    
    async def _get_cached_price(self, symbol: str) -> Optional[PriceResponse]:
        """Get price from Redis cache"""
        try:
            if not cache.redis_client:
                return None
                
            cached_data = await cache.redis_client.get(f"price:{symbol}")
            if cached_data:
                data = json.loads(cached_data)
                return PriceResponse(**data)
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached price for {symbol}: {e}")
            return None
    
    async def _cache_price(self, price: StockPrice) -> None:
        """Cache price in Redis"""
        try:
            if not cache.redis_client:
                return
                
            price_response = self._to_price_response(price)
            await cache.redis_client.setex(
                f"price:{price.symbol}",
                settings.cache_ttl_seconds,
                json.dumps(price_response.dict(), default=str)
            )
            
        except Exception as e:
            logger.error(f"Error caching price for {price.symbol}: {e}")
    
    async def _get_db_price(self, symbol: str) -> Optional[StockPrice]:
        """Get latest price from MongoDB"""
        try:
            price_doc = await db.database.stock_prices.find_one(
                {"symbol": symbol},
                sort=[("fetched_at", -1)]
            )
            
            if price_doc:
                return StockPrice(**price_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting DB price for {symbol}: {e}")
            return None
    
    async def _fetch_and_store_price(self, symbol: str) -> Optional[PriceResponse]:
        """Fetch fresh price and store in DB and cache"""
        try:
            fetcher = create_stock_fetcher(symbol)
            if not fetcher:
                logger.error(f"No suitable fetcher found for symbol: {symbol}")
                return None
                
            price_data = await fetcher.fetch_price(symbol)
            
            if not price_data:
                return None
            
            # Store in MongoDB
            stock_price = StockPrice(**price_data)
            await db.database.stock_prices.insert_one(stock_price.dict(by_alias=True))
            
            # Cache in Redis
            await self._cache_price(stock_price)
            
            return self._to_price_response(stock_price)
            
        except Exception as e:
            logger.error(f"Error fetching and storing price for {symbol}: {e}")
            return None
    
    async def _update_tracking(self, symbol: str) -> None:
        """Update last queried timestamp for tracked symbol"""
        try:
            await db.database.tracked_symbols.update_one(
                {"symbol": symbol},
                {"$set": {"last_queried_at": datetime.utcnow()}}
            )
        except Exception as e:
            logger.error(f"Error updating tracking for {symbol}: {e}")
    
    async def _get_tracked_symbols(self) -> list[dict[str, Any]]:
        """Get all tracked symbols"""
        try:
            cursor = db.database.tracked_symbols.find({})
            return await cursor.to_list(length=None)
        except Exception as e:
            logger.error(f"Error getting tracked symbols: {e}")
            return []
    
    async def _cleanup_old_tracked_symbols(self) -> None:
        """Remove symbols not queried for more than 7 days"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=settings.tracking_expiry_days)
            result = await db.database.tracked_symbols.delete_many(
                {"last_queried_at": {"$lt": cutoff_date}}
            )
            
            if result.deleted_count > 0:
                logger.info(f"Cleaned up {result.deleted_count} old tracked symbols")
                
        except Exception as e:
            logger.error(f"Error cleaning up old tracked symbols: {e}")
    
    def _is_price_fresh(self, fetched_at: datetime) -> bool:
        """Check if price is still fresh (within cache TTL)"""
        age = datetime.utcnow() - fetched_at
        return age.total_seconds() < settings.cache_ttl_seconds
    
    def _to_price_response(self, stock_price: StockPrice) -> PriceResponse:
        """Convert StockPrice to PriceResponse"""
        return PriceResponse(
            symbol=stock_price.symbol,
            price=stock_price.price,
            currency=stock_price.currency,
            market=stock_price.market,
            date=stock_price.date,
            fetched_at=stock_price.fetched_at,
            percent_change=stock_price.percent_change
        ) 