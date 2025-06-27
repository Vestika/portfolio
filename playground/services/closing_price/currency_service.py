import asyncio
import httpx
from datetime import datetime, date
from loguru import logger
from typing import Optional, Dict, Any

from .config import settings


class CurrencyService:
    """Service for fetching real-time currency exchange rates"""
    
    def __init__(self):
        self.timeout = 10.0
        self.base_url = "https://api.exchangerate-api.com/v4/latest"
        # Backup URL if primary fails
        self.backup_url = "https://open.er-api.com/v6/latest"
    
    async def get_exchange_rate(self, from_currency: str, to_currency: str) -> Optional[float]:
        """
        Get exchange rate from one currency to another
        
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
            
            # Try primary API first
            rate = await self._fetch_rate_primary(from_currency, to_currency)
            if rate is not None:
                return rate
            
            # Fallback to backup API
            logger.warning(f"Primary API failed, trying backup for {from_currency}/{to_currency}")
            rate = await self._fetch_rate_backup(from_currency, to_currency)
            if rate is not None:
                return rate
                
            logger.error(f"All currency APIs failed for {from_currency}/{to_currency}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting exchange rate {from_currency}/{to_currency}: {e}")
            return None
    
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