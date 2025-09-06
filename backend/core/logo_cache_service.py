import logging
from datetime import datetime, timedelta
from typing import Optional

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
        """Store logo URL in the database (create entry if it doesn't exist)."""
        try:
            result = await self.symbols_collection.update_one(
                {"symbol": {"$regex": f"^{symbol}$", "$options": "i"}},  # case-insensitive exact match
                {
                    "$set": {
                        "logo_url": logo_url,
                        "updated_at": datetime.utcnow(),
                    },
                    "$setOnInsert": {
                        "symbol": symbol,
                        "name": symbol,  # placeholder
                        "symbol_type": "other",
                        "currency": "USD",
                        "logo_updated_at": datetime.utcnow(),
                        "created_at": datetime.utcnow(),
                        "is_active": True,
                    }
                },
                upsert=True
            )

            if result.upserted_id:
                logger.info(f"Created new symbol entry for {symbol}")
            elif result.modified_count:
                logger.info(f"Updated logo for existing symbol {symbol}")

            return True

        except Exception as e:
            logger.error(f"Error caching logo for {symbol}: {e}")
            return False