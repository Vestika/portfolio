import json
import httpx
from datetime import datetime, timedelta
from loguru import logger
from typing import Optional, Any, Dict

from config import settings
from .stock_fetcher import create_stock_fetcher, detect_symbol_type
from .database import db, cache, ensure_connections
from .models import StockPrice, TrackedSymbol, PriceResponse
from .currency_service import currency_service


class PriceManager:
    """Manages stock price fetching, caching, and tracking"""
    
    async def get_price(self, symbol: str, *, fresh: bool = False) -> Optional[PriceResponse]:
        """Get the latest price for a symbol, with lazy fetching and caching.

        Args:
            symbol: The symbol to fetch.
            fresh: If True, bypass cache/DB freshness checks and fetch from source.
        """
        try:
            # Ensure DB/cache connections are valid for this loop
            await ensure_connections()
            if not fresh:
                # First check Redis cache
                cached_price = await self._get_cached_price(symbol)
                if cached_price:
                    logger.info(f"Retrieved cached price for {symbol}")
                    await self._update_tracking(symbol)
                    return cached_price
                
                # Check MongoDB for recent price
                db_price = await self._get_db_price(symbol)
                if db_price and self._is_price_fresh(db_price.fetched_at):
                    logger.info(f"Retrieved fresh price from DB for {symbol}")
                    await self._cache_price(db_price)
                    await self._update_tracking(symbol)
                    return self._to_price_response(db_price)
            
            # Fetch fresh price (either because fresh=True or no fresh cached/DB price)
            logger.info(f"Fetching fresh price for {symbol} (fresh={fresh})")
            fresh_price = await self._fetch_and_store_price(symbol)
            if fresh_price:
                await self._update_tracking(symbol)
                return fresh_price
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {e}")
            return None

    async def get_prices(self, symbols: list[str], *, fresh: bool = False) -> list[PriceResponse]:
        """Get prices for a list of symbols with optional fresh bypass.

        Returns only successfully resolved prices.
        """
        results: list[PriceResponse] = []
        for symbol in symbols:
            price = await self.get_price(symbol, fresh=fresh)
            if price:
                results.append(price)
        return results

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
    
    async def track_symbols(self, symbols: list[str]) -> dict[str, str]:
        """Add symbols to tracking list"""
        results = {}
        
        for symbol in symbols:
            try:
                # Detect symbol type and determine market with new types
                if symbol.startswith("FX:"):
                    symbol_type = "currency"
                    market_type = "CURRENCY"
                elif symbol.endswith("-USD") and not symbol.isdigit():
                    symbol_type = "crypto"
                    market_type = "CRYPTO"
                else:
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
            # Handle different symbol types with appropriate data sources
            if symbol.startswith("FX:"):
                # Currency symbol - use currency_service
                price_data = await self._fetch_currency_price(symbol)
            elif symbol.endswith("-USD") and not symbol.isdigit():
                # Crypto symbol - use special crypto fetcher
                price_data = await self._fetch_crypto_price(symbol)
            else:
                # Regular stock - use existing stock_fetcher
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
    
    async def _fetch_currency_price(self, symbol: str) -> Optional[dict[str, Any]]:
        """Fetch currency price using currency_service - prices in ILS terms for ILS-based portfolio"""
        try:
            # Extract currency code from FX:USD format
            currency_code = symbol[3:]  # Remove "FX:" prefix
            
            # Get the rate in ILS terms (ILS is the base currency for this portfolio)
            if currency_code == "ILS":
                # For ILS, return 1.0 as it's the base currency
                rate = 1.0
            else:
                # Get exchange rate from this currency to ILS
                rate = await currency_service.get_exchange_rate(currency_code, "ILS")
                if rate is None:
                    logger.error(f"Failed to get {currency_code}/ILS exchange rate")
                    return None
            
            # Get symbol mapping from database to use yfinance symbol for historical data
            symbol_doc = await self._get_symbol_mapping(symbol)
            yfinance_symbol = symbol_doc.get("yfinance_symbol", f"{currency_code}ILS=X") if symbol_doc else f"{currency_code}ILS=X"
            
            return {
                "symbol": symbol,
                "price": float(rate),
                "currency": "ILS",  # All currency rates are in ILS for ILS-based portfolio
                "market": "CURRENCY",
                "source": "currency_service",
                "fetched_at": datetime.utcnow(),
                "date": datetime.utcnow().strftime("%Y-%m-%d"),
                "yfinance_symbol": yfinance_symbol,  # For historical data
                "change_percent": 0.0  # Currency service doesn't provide change %
            }
            
        except Exception as e:
            logger.error(f"Error fetching currency price for {symbol}: {e}")
            return None
    
    async def _fetch_crypto_price(self, symbol: str) -> Optional[dict[str, Any]]:
        """Fetch crypto price using Finnhub with BINANCE: prefix"""
        try:
            if not settings.finnhub_api_key:
                logger.error("Finnhub API key not configured for crypto")
                return None
            
            # Get symbol mapping from database to use correct Finnhub format
            symbol_doc = await self._get_symbol_mapping(symbol)
            finnhub_symbol = symbol_doc.get("finnhub_symbol") if symbol_doc else None
            
            if not finnhub_symbol:
                # Fallback: convert BTC-USD to BINANCE:BTCUSDT format
                crypto_code = symbol.split("-")[0]
                finnhub_symbol = f"BINANCE:{crypto_code}USDT"
                logger.warning(f"No mapping found for {symbol}, using fallback: {finnhub_symbol}")
            
            # Fetch from Finnhub with the correct format
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": finnhub_symbol, "token": settings.finnhub_api_key},
                    timeout=10.0
                )
                response.raise_for_status()
                
                data = response.json()
                current_price = data.get("c")
                
                if current_price is None or current_price == 0:
                    logger.warning(f"No price data available for crypto symbol: {finnhub_symbol}")
                    return None
                
                return {
                    "symbol": symbol,
                    "price": float(current_price),
                    "currency": "USD",  # Crypto prices are in USD
                    "market": "CRYPTO",
                    "source": "finnhub",
                    "fetched_at": datetime.utcnow(),
                    "date": datetime.utcnow().strftime("%Y-%m-%d"),
                    "previous_close": data.get("pc"),
                    "change": data.get("d"),
                    "change_percent": data.get("dp", 0.0),
                    "high": data.get("h"),
                    "low": data.get("l"),
                    "open": data.get("o"),
                    "finnhub_symbol": finnhub_symbol  # Store the actual symbol used
                }
                
        except Exception as e:
            logger.error(f"Error fetching crypto price for {symbol}: {e}")
            return None
    
    async def _get_symbol_mapping(self, symbol: str) -> Optional[dict[str, Any]]:
        """Get symbol mapping from symbols collection for yfinance/finnhub routing"""
        try:
            from core.database import db_manager
            
            # Ensure db_manager is connected
            if not hasattr(db_manager, '_database') or db_manager._database is None:
                await db_manager.connect("vestika")
            
            # Get the symbols collection 
            collection = db_manager.get_collection("symbols")
            symbol_doc = await collection.find_one({"symbol": symbol})
            
            return symbol_doc
            
        except Exception as e:
            logger.error(f"Error getting symbol mapping for {symbol}: {e}")
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
            change_percent=stock_price.change_percent
        )
    
    async def get_historical_prices(
        self, 
        symbols: list[str], 
        days: int = 7
    ) -> Dict[str, list[Dict[str, Any]]]:
        """
        Get historical prices for multiple symbols from MongoDB (FAST!).
        
        This retrieves pre-cached historical data from the time-series collection,
        which is much faster than fetching from yfinance on every request.
        
        Args:
            symbols: List of symbols to fetch
            days: Number of days of history (default: 7)
        
        Returns:
            Dictionary mapping symbol to list of historical price points
            Format: {"AAPL": [{"date": "2025-11-14", "price": 150.50}, ...]}
        """
        try:
            await ensure_connections()
            
            # Calculate date range
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            logger.info(f"[GET HISTORICAL] Fetching {days}-day history for {len(symbols)} symbols from MongoDB")
            
            # Query time-series collection (optimized for this!)
            cursor = db.database.historical_prices.find({
                "symbol": {"$in": symbols},
                "timestamp": {"$gte": start_date}
            }).sort("timestamp", 1)
            
            # Fetch all data
            all_data = await cursor.to_list(length=None)
            
            # Group by symbol
            result: Dict[str, list[Dict[str, Any]]] = {symbol: [] for symbol in symbols}
            
            for doc in all_data:
                symbol = doc["symbol"]
                if symbol in result:
                    result[symbol].append({
                        "date": doc["timestamp"].strftime("%Y-%m-%d"),
                        "price": doc["close"]
                    })
            
            # Log statistics
            total_records = sum(len(prices) for prices in result.values())
            symbols_with_data = sum(1 for prices in result.values() if prices)
            
            logger.info(
                f"[GET HISTORICAL] Retrieved {total_records} records for "
                f"{symbols_with_data}/{len(symbols)} symbols"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"[GET HISTORICAL] Error fetching historical prices: {e}")
            return {symbol: [] for symbol in symbols} 