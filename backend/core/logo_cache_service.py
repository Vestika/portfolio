import logging
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId

from models.symbol import Symbol
from core.database import db_manager
from services.closing_price.stock_fetcher import FinnhubFetcher
from config import settings

logger = logging.getLogger(__name__)


class LogoCacheService:
    """Service for caching and managing company logos"""
    
    def __init__(self):
        self.db = db_manager
        self.symbols_collection = self.db.get_collection("symbols")
        self.fetcher = FinnhubFetcher(settings.finnhub_api_key)
        
        # Logo cache expiration time (30 days)
        self.logo_expiration_days = 30
        
    async def get_logo(self, symbol: str) -> Optional[str]:
        """
        Get logo URL for a symbol, checking cache first then fetching from API if needed
        """
        try:
            # First, try to get from cache
            cached_logo = await self._get_cached_logo(symbol)
            if cached_logo:
                return cached_logo
            
            # If not in cache or expired, fetch from API
            logo_url = await self._fetch_and_cache_logo(symbol)
            return logo_url
            
        except Exception as e:
            logger.error(f"Error getting logo for {symbol}: {e}")
            return None
    
    async def _get_cached_logo(self, symbol: str) -> Optional[str]:
        """Get logo from cache if it exists and is not expired"""
        try:
            # Find symbol document
            symbol_doc = await self.symbols_collection.find_one({"symbol": symbol})
            if not symbol_doc:
                return None
            
            # Check if logo exists and is not expired
            logo_url = symbol_doc.get("logo_url")
            logo_updated_at = symbol_doc.get("logo_updated_at")
            
            if not logo_url or not logo_updated_at:
                return None
            
            # Check if logo is expired
            if isinstance(logo_updated_at, str):
                logo_updated_at = datetime.fromisoformat(logo_updated_at.replace('Z', '+00:00'))
            
            expiration_date = logo_updated_at + timedelta(days=self.logo_expiration_days)
            if datetime.utcnow() > expiration_date:
                logger.info(f"Logo for {symbol} is expired, will refresh")
                return None
            
            logger.debug(f"Returning cached logo for {symbol}")
            return logo_url
            
        except Exception as e:
            logger.error(f"Error getting cached logo for {symbol}: {e}")
            return None
    
    async def _fetch_and_cache_logo(self, symbol: str) -> Optional[str]:
        """Fetch logo from API and cache it in the database"""
        try:
            # Fetch logo from Finnhub API
            logo_url = await self.fetcher.get_company_logo(symbol)
            if not logo_url:
                logger.warning(f"No logo found for {symbol}")
                return None
            
            # Cache the logo in the database
            await self._cache_logo(symbol, logo_url)
            logger.info(f"Cached logo for {symbol}: {logo_url}")
            
            return logo_url
            
        except Exception as e:
            logger.error(f"Error fetching logo for {symbol}: {e}")
            return None
    
    async def _cache_logo(self, symbol: str, logo_url: str) -> bool:
        """Store logo URL in the database"""
        try:
            # Try to update existing symbol document
            result = await self.symbols_collection.update_one(
                {"symbol": symbol},
                {
                    "$set": {
                        "logo_url": logo_url,
                        "logo_updated_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.matched_count == 0:
                # Symbol doesn't exist, create a basic entry
                symbol_doc = {
                    "symbol": symbol,
                    "name": symbol,  # Placeholder name
                    "symbol_type": "other",
                    "currency": "USD",  # Default currency
                    "logo_url": logo_url,
                    "logo_updated_at": datetime.utcnow(),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "is_active": True
                }
                await self.symbols_collection.insert_one(symbol_doc)
                logger.info(f"Created new symbol entry for {symbol}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error caching logo for {symbol}: {e}")
            return False
    
    async def refresh_expired_logos(self) -> dict[str, int]:
        """Refresh all expired logos in the database"""
        try:
            expiration_date = datetime.utcnow() - timedelta(days=self.logo_expiration_days)
            
            # Find symbols with expired logos
            expired_symbols = self.symbols_collection.find({
                "logo_url": {"$exists": True},
                "logo_updated_at": {"$lt": expiration_date}
            })
            
            refreshed_count = 0
            failed_count = 0
            
            async for symbol_doc in expired_symbols:
                symbol = symbol_doc["symbol"]
                try:
                    logo_url = await self.fetcher.get_company_logo(symbol)
                    if logo_url:
                        await self._cache_logo(symbol, logo_url)
                        refreshed_count += 1
                        logger.info(f"Refreshed logo for {symbol}")
                    else:
                        failed_count += 1
                        logger.warning(f"Failed to refresh logo for {symbol}")
                except Exception as e:
                    failed_count += 1
                    logger.error(f"Error refreshing logo for {symbol}: {e}")
            
            logger.info(f"Logo refresh completed: {refreshed_count} refreshed, {failed_count} failed")
            return {
                "refreshed": refreshed_count,
                "failed": failed_count
            }
            
        except Exception as e:
            logger.error(f"Error refreshing expired logos: {e}")
            return {"refreshed": 0, "failed": 0}
    
    async def get_logo_stats(self) -> dict[str, int]:
        """Get statistics about cached logos"""
        try:
            total_symbols = await self.symbols_collection.count_documents({})
            symbols_with_logos = await self.symbols_collection.count_documents({"logo_url": {"$exists": True}})
            
            # Count expired logos
            expiration_date = datetime.utcnow() - timedelta(days=self.logo_expiration_days)
            expired_logos = await self.symbols_collection.count_documents({
                "logo_url": {"$exists": True},
                "logo_updated_at": {"$lt": expiration_date}
            })
            
            return {
                "total_symbols": total_symbols,
                "symbols_with_logos": symbols_with_logos,
                "expired_logos": expired_logos,
                "fresh_logos": symbols_with_logos - expired_logos
            }
            
        except Exception as e:
            logger.error(f"Error getting logo stats: {e}")
            return {}
