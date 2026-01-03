import httpx
from datetime import datetime, date
from loguru import logger
from typing import Optional, Dict, Any


# Cache freshness threshold (15 minutes matches the live updater interval)
CACHE_FRESHNESS_SECONDS = 900


class CurrencyService:
    """Service for fetching real-time currency exchange rates with in-memory caching"""
    
    def __init__(self):
        self.timeout = 10.0
        self.base_url = "https://api.exchangerate-api.com/v4/latest"
        # Backup URL if primary fails
        self.backup_url = "https://open.er-api.com/v6/latest"
    
    def _get_fx_symbol(self, from_currency: str, to_currency: str) -> str:
        """Generate FX symbol for cache lookup (e.g., FX:USD for USD/ILS)"""
        return f"FX:{from_currency.upper()}"
    
    def _is_cache_fresh(self, last_update: datetime) -> bool:
        """Check if cached data is still fresh (within 15 minutes)"""
        age = datetime.utcnow() - last_update
        return age.total_seconds() < CACHE_FRESHNESS_SECONDS
    
    async def get_exchange_rate(self, from_currency: str, to_currency: str) -> Optional[float]:
        """
        Get exchange rate from one currency to another.
        
        Uses the following priority:
        1. In-memory live cache (fastest, refreshed every 15 min by scheduler)
        2. External API (only on cache miss or stale data)
        
        Note: No MongoDB caching - the scheduler refreshes rates every 15 min
        and populates the cache on startup (T+0), so persistence isn't needed.
        
        Args:
            from_currency: Source currency (e.g., 'USD')
            to_currency: Target currency (e.g., 'ILS')
            
        Returns:
            Exchange rate as float, or None if failed
        """
        try:
            # If same currency, return 1.0
            if from_currency.upper() == to_currency.upper():
                return 1.0
            
            # Generate the FX symbol for cache lookup
            fx_symbol = self._get_fx_symbol(from_currency, to_currency)
            
            # 1. Try in-memory live cache first (fastest)
            cached_rate = self._get_from_live_cache(fx_symbol)
            if cached_rate is not None:
                logger.debug(f"Using cached exchange rate for {from_currency}/{to_currency}: {cached_rate}")
                return cached_rate
            
            # 2. Fetch from external API (cache miss)
            logger.info(f"Fetching exchange rate from API for {from_currency}/{to_currency}")
            rate = await self._fetch_rate_primary(from_currency, to_currency)
            if rate is not None:
                # Cache the result in live cache
                self._update_live_cache(fx_symbol, rate, to_currency)
                return rate
            
            # Fallback to backup API
            logger.warning(f"Primary API failed, trying backup for {from_currency}/{to_currency}")
            rate = await self._fetch_rate_backup(from_currency, to_currency)
            if rate is not None:
                self._update_live_cache(fx_symbol, rate, to_currency)
                return rate
                
            logger.error(f"All currency APIs failed for {from_currency}/{to_currency}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting exchange rate {from_currency}/{to_currency}: {e}")
            return None
    
    def _get_from_live_cache(self, fx_symbol: str) -> Optional[float]:
        """Get exchange rate from in-memory live cache"""
        try:
            from .live_price_cache import get_live_price_cache
            
            cache = get_live_price_cache()
            cached_data = cache.get(fx_symbol)
            
            if cached_data:
                last_update = cached_data.get("last_update")
                if last_update and self._is_cache_fresh(last_update):
                    return cached_data.get("price")
                else:
                    logger.debug(f"Live cache for {fx_symbol} is stale")
            
            return None
        except Exception as e:
            logger.debug(f"Error checking live cache for {fx_symbol}: {e}")
            return None
    
    def _update_live_cache(self, fx_symbol: str, rate: float, to_currency: str) -> None:
        """Update the in-memory live cache with the exchange rate"""
        try:
            from .live_price_cache import get_live_price_cache
            
            cache = get_live_price_cache()
            cache.set(
                symbol=fx_symbol,
                price=rate,
                currency=to_currency.upper(),
                market="CURRENCY"
            )
        except Exception as e:
            logger.debug(f"Error updating live cache for {fx_symbol}: {e}")
    
    async def _fetch_rate_primary(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Fetch from exchangerate-api.com (primary API)"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/{from_currency.upper()}",
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                rates = data.get("rates", {})
                
                if to_currency.upper() in rates:
                    rate = float(rates[to_currency.upper()])
                    logger.info(f"Successfully fetched {from_currency}/{to_currency} rate: {rate}")
                    return rate
                else:
                    logger.warning(f"Currency {to_currency} not found in rates from primary API")
                    return None
                    
        except httpx.HTTPError as e:
            logger.warning(f"HTTP error from primary currency API: {e}")
            return None
        except Exception as e:
            logger.warning(f"Error from primary currency API: {e}")
            return None
    
    async def _fetch_rate_backup(self, from_currency: str, to_currency: str) -> Optional[float]:
        """Fetch from open.er-api.com (backup API)"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.backup_url}/{from_currency.upper()}",
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                rates = data.get("rates", {})
                
                if to_currency.upper() in rates:
                    rate = float(rates[to_currency.upper()])
                    logger.info(f"Successfully fetched {from_currency}/{to_currency} rate from backup: {rate}")
                    return rate
                else:
                    logger.warning(f"Currency {to_currency} not found in rates from backup API")
                    return None
                    
        except httpx.HTTPError as e:
            logger.warning(f"HTTP error from backup currency API: {e}")
            return None
        except Exception as e:
            logger.warning(f"Error from backup currency API: {e}")
            return None
    
    async def get_supported_currencies(self) -> Optional[list[str]]:
        """Get list of supported currencies"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/USD",
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                rates = data.get("rates", {})
                
                # Return list of currency codes
                currencies = ["USD"] + list(rates.keys())
                logger.info(f"Retrieved {len(currencies)} supported currencies")
                return sorted(currencies)
                
        except Exception as e:
            logger.error(f"Error getting supported currencies: {e}")
            return None
    
    async def get_currency_info(self, from_currency: str, to_currency: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed currency information including rate, timestamp, etc.
        
        Returns:
            Dictionary with rate, timestamp, source, etc.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/{from_currency.upper()}",
                    timeout=self.timeout
                )
                response.raise_for_status()
                
                data = response.json()
                rates = data.get("rates", {})
                
                if to_currency.upper() not in rates:
                    return None
                
                rate = float(rates[to_currency.upper()])
                
                return {
                    "from_currency": from_currency.upper(),
                    "to_currency": to_currency.upper(),
                    "rate": rate,
                    "date": data.get("date", date.today().isoformat()),
                    "timestamp": data.get("time_last_updated", int(datetime.utcnow().timestamp())),
                    "source": "exchangerate-api.com",
                    "fetched_at": datetime.utcnow()
                }
                
        except Exception as e:
            logger.error(f"Error getting currency info for {from_currency}/{to_currency}: {e}")
            return None


# Global instance
currency_service = CurrencyService() 