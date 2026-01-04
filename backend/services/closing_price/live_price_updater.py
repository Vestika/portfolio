"""
Live Price Cache Updater Service

Background service that continuously updates the in-memory live price cache
every 15 minutes during trading hours using Finnhub API.

This service:
1. Gets all tracked symbols from MongoDB
2. Fetches live prices from Finnhub in batches
3. Updates the in-memory cache
4. Runs continuously in the background
"""
import asyncio
import httpx
from datetime import datetime
from typing import Dict, Any, List, Optional
from loguru import logger

from .database import db, ensure_connections
from .live_price_cache import get_live_price_cache
from .stock_fetcher import FinnhubFetcher, TaseFetcher
from config import settings


class LivePriceUpdaterService:
    """Background service to update live prices periodically"""
    
    def __init__(self, update_interval_seconds: int = 900):  # 15 minutes = 900 seconds
        self.update_interval = update_interval_seconds
        self.live_cache = get_live_price_cache()
        self.running = False
        self.task: Optional[asyncio.Task] = None
        
        # Initialize fetchers
        self.finnhub_fetcher = FinnhubFetcher(settings.finnhub_api_key) if settings.finnhub_api_key else None
        self.tase_fetcher = TaseFetcher()
    
    async def start(self) -> None:
        """Start the background update service"""
        if self.running:
            logger.warning("[LIVE UPDATER] Service is already running")
            return
        
        self.running = True
        self.task = asyncio.create_task(self._update_loop())
        logger.info(f"[LIVE UPDATER] Started background service (interval: {self.update_interval}s)")
    
    async def stop(self) -> None:
        """Stop the background update service"""
        if not self.running:
            return
        
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        
        logger.info("[LIVE UPDATER] Stopped background service")
    
    async def _update_loop(self) -> None:
        """Main update loop - runs continuously"""
        logger.info("[LIVE UPDATER] Update loop started")
        
        while self.running:
            try:
                await self._update_all_prices()
                
                # Wait for next interval
                logger.info(f"[LIVE UPDATER] Sleeping for {self.update_interval}s until next update")
                await asyncio.sleep(self.update_interval)
                
            except asyncio.CancelledError:
                logger.info("[LIVE UPDATER] Update loop cancelled")
                break
            except Exception as e:
                logger.error(f"[LIVE UPDATER] Error in update loop: {e}")
                # Wait a bit before retrying on error
                await asyncio.sleep(60)
    
    async def _update_all_prices(self) -> Dict[str, Any]:
        """
        Update all tracked symbols with fresh prices.
        
        Returns:
            Dictionary with update statistics
        """
        try:
            await ensure_connections()
            
            logger.info("[LIVE UPDATER] Starting price update cycle")
            
            # Get all tracked symbols
            tracked_symbols = await db.database.tracked_symbols.find({}).to_list(length=None)
            
            if not tracked_symbols:
                logger.info("[LIVE UPDATER] No tracked symbols found")
                return {"updated": 0, "errors": 0}
            
            logger.info(f"[LIVE UPDATER] Updating {len(tracked_symbols)} tracked symbols")
            
            # Group symbols by market for efficient fetching
            us_symbols = []
            tase_symbols = []
            currency_symbols = []
            crypto_symbols = []
            
            for symbol_doc in tracked_symbols:
                symbol = symbol_doc["symbol"]
                market = symbol_doc.get("market", "US")
                
                if market == "US":
                    us_symbols.append(symbol)
                elif market == "TASE":
                    tase_symbols.append(symbol)
                elif market == "CURRENCY":
                    currency_symbols.append(symbol)
                elif market == "CRYPTO":
                    crypto_symbols.append(symbol)
            
            # Fetch prices by market type
            updated_count = 0
            error_count = 0
            
            # Update US stocks (using Finnhub)
            if us_symbols:
                result = await self._update_us_stocks(us_symbols)
                updated_count += result["updated"]
                error_count += result["errors"]
            
            # Update TASE stocks
            if tase_symbols:
                result = await self._update_tase_stocks(tase_symbols)
                updated_count += result["updated"]
                error_count += result["errors"]
            
            # Update currency prices
            if currency_symbols:
                result = await self._update_currencies(currency_symbols)
                updated_count += result["updated"]
                error_count += result["errors"]
            
            # Update crypto prices
            if crypto_symbols:
                result = await self._update_crypto(crypto_symbols)
                updated_count += result["updated"]
                error_count += result["errors"]
            
            logger.info(
                f"[LIVE UPDATER] Update cycle completed: "
                f"{updated_count} updated, {error_count} errors"
            )
            
            return {
                "updated": updated_count,
                "errors": error_count,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"[LIVE UPDATER] Error updating prices: {e}")
            return {"updated": 0, "errors": 1, "error": str(e)}
    
    async def _update_us_stocks(self, symbols: List[str]) -> Dict[str, int]:
        """Update US stock prices using Finnhub (batch API)"""
        updated = 0
        errors = 0
        
        try:
            if not self.finnhub_fetcher:
                logger.warning("[LIVE UPDATER] Finnhub API key not configured")
                return {"updated": 0, "errors": len(symbols)}
            
            # Finnhub has a batch quote API, but for simplicity, we'll fetch individually
            # In production, you might want to use batch API or add rate limiting
            
            # Process in batches to avoid rate limiting
            batch_size = 10
            for i in range(0, len(symbols), batch_size):
                batch = symbols[i:i + batch_size]
                
                for symbol in batch:
                    try:
                        price_data = await self.finnhub_fetcher.fetch_price(symbol)
                        
                        if price_data:
                            self.live_cache.set(
                                symbol=symbol,
                                price=price_data["price"],
                                currency=price_data.get("currency", "USD"),
                                market="US",
                                change_percent=price_data.get("change_percent")
                            )
                            updated += 1
                        else:
                            errors += 1
                            
                    except Exception as e:
                        logger.error(f"[LIVE UPDATER] Error fetching {symbol}: {e}")
                        errors += 1
                
                # Small delay between batches to respect rate limits
                if i + batch_size < len(symbols):
                    await asyncio.sleep(1)
            
            logger.info(f"[LIVE UPDATER] US stocks: {updated} updated, {errors} errors")
            
        except Exception as e:
            logger.error(f"[LIVE UPDATER] Error updating US stocks: {e}")
            errors = len(symbols)
        
        return {"updated": updated, "errors": errors}
    
    async def _update_tase_stocks(self, symbols: List[str]) -> Dict[str, int]:
        """Update TASE stock prices using pymaya"""
        updated = 0
        errors = 0
        
        try:
            for symbol in symbols:
                try:
                    price_data = await self.tase_fetcher.fetch_price(symbol)
                    
                    if price_data:
                        self.live_cache.set(
                            symbol=symbol,
                            price=price_data["price"],
                            currency=price_data.get("currency", "ILS"),
                            market="TASE",
                            change_percent=price_data.get("change_percent")
                        )
                        updated += 1
                    else:
                        errors += 1
                        
                except Exception as e:
                    logger.error(f"[LIVE UPDATER] Error fetching TASE {symbol}: {e}")
                    errors += 1
                
                # Small delay between requests
                await asyncio.sleep(0.5)
            
            logger.info(f"[LIVE UPDATER] TASE stocks: {updated} updated, {errors} errors")
            
        except Exception as e:
            logger.error(f"[LIVE UPDATER] Error updating TASE stocks: {e}")
            errors = len(symbols)
        
        return {"updated": updated, "errors": errors}
    
    async def _update_currencies(self, symbols: List[str]) -> Dict[str, int]:
        """Update currency prices using currency service"""
        updated = 0
        errors = 0
        
        try:
            from .currency_service import currency_service
            
            for symbol in symbols:
                try:
                    # Extract currency code from FX:USD format
                    if symbol.startswith("FX:"):
                        currency_code = symbol[3:]
                    else:
                        currency_code = symbol
                    
                    # Get rate to ILS (or USD, depending on your base currency)
                    rate = await currency_service.get_exchange_rate(currency_code, "ILS")
                    
                    if rate:
                        self.live_cache.set(
                            symbol=symbol,
                            price=rate,
                            currency="ILS",
                            market="CURRENCY"
                        )
                        updated += 1
                    else:
                        errors += 1
                        
                except Exception as e:
                    logger.error(f"[LIVE UPDATER] Error fetching currency {symbol}: {e}")
                    errors += 1
            
            logger.info(f"[LIVE UPDATER] Currencies: {updated} updated, {errors} errors")
            
        except Exception as e:
            logger.error(f"[LIVE UPDATER] Error updating currencies: {e}")
            errors = len(symbols)
        
        return {"updated": updated, "errors": errors}
    
    async def _update_crypto(self, symbols: List[str]) -> Dict[str, int]:
        """Update crypto prices using Finnhub"""
        updated = 0
        errors = 0
        
        try:
            if not self.finnhub_fetcher:
                logger.warning("[LIVE UPDATER] Finnhub API key not configured for crypto")
                return {"updated": 0, "errors": len(symbols)}
            
            for symbol in symbols:
                try:
                    # Convert to Finnhub format (e.g., BTC-USD -> BINANCE:BTCUSDT)
                    crypto_code = symbol.split("-")[0] if "-" in symbol else symbol
                    finnhub_symbol = f"BINANCE:{crypto_code}USDT"
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            "https://finnhub.io/api/v1/quote",
                            params={"symbol": finnhub_symbol, "token": settings.finnhub_api_key},
                            timeout=10.0
                        )
                        response.raise_for_status()
                        
                        data = response.json()
                        current_price = data.get("c")
                        
                        if current_price and current_price > 0:
                            self.live_cache.set(
                                symbol=symbol,
                                price=current_price,
                                currency="USD",
                                market="CRYPTO",
                                change_percent=data.get("dp", 0.0)
                            )
                            updated += 1
                        else:
                            errors += 1
                            
                except Exception as e:
                    logger.error(f"[LIVE UPDATER] Error fetching crypto {symbol}: {e}")
                    errors += 1
                
                # Small delay between requests
                await asyncio.sleep(0.5)
            
            logger.info(f"[LIVE UPDATER] Crypto: {updated} updated, {errors} errors")
            
        except Exception as e:
            logger.error(f"[LIVE UPDATER] Error updating crypto: {e}")
            errors = len(symbols)
        
        return {"updated": updated, "errors": errors}
    
    async def update_once(self) -> Dict[str, Any]:
        """
        Manually trigger a single update cycle (useful for testing).
        
        Returns:
            Dictionary with update statistics
        """
        return await self._update_all_prices()


# Global singleton instance
_updater_service: Optional[LivePriceUpdaterService] = None


def get_updater_service() -> LivePriceUpdaterService:
    """Get the global live price updater service instance"""
    global _updater_service
    if _updater_service is None:
        _updater_service = LivePriceUpdaterService()
        logger.info("[LIVE UPDATER] Initialized updater service")
    return _updater_service

