"""
Earnings calendar service using Finnhub API
"""
import finnhub
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

from config import settings

logger = logging.getLogger(__name__)

class EarningsService:
    def __init__(self):
        """Initialize Finnhub client with API key from settings"""
        self.api_key = settings.finnhub_api_key
        if not self.api_key:
            logger.warning("FINNHUB_API_KEY not found in settings (check your .env file)")
            self.client = None
        else:
            self.client = finnhub.Client(api_key=self.api_key)
            logger.info("✅ [EARNINGS] Finnhub client initialized successfully")

    async def get_earnings_calendar(
        self, 
        symbols: List[str], 
        from_date: Optional[date] = None, 
        to_date: Optional[date] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get earnings calendar data for multiple symbols
        Returns 1 upcoming earnings and 3 previous earnings per symbol
        
        Args:
            symbols: List of stock symbols to fetch earnings for
            from_date: Start date for earnings data (defaults to 1 year ago)
            to_date: End date for earnings data (defaults to 1 year from now)
            
        Returns:
            Dictionary mapping symbol to list of earnings data (1 upcoming + 3 previous)
        """
        if not self.client:
            logger.warning("❌ [EARNINGS] Finnhub client not available - returning empty data")
            return {symbol: [] for symbol in symbols}
        
        # Set default date range if not provided
        if not from_date:
            from_date = date.today() - timedelta(days=365)  # 1 year ago
        if not to_date:
            to_date = date.today() + timedelta(days=365)    # 1 year from now
        
        logger.info(f"📅 [EARNINGS] Fetching earnings calendar for {len(symbols)} symbols from {from_date} to {to_date}")
        
        earnings_data = {}
        
        for symbol in symbols:
            try:
                logger.info(f"🔍 [EARNINGS] Fetching earnings for {symbol}")
                
                # Call Finnhub API
                response = self.client.earnings_calendar(
                    _from=from_date.strftime("%Y-%m-%d"),
                    to=to_date.strftime("%Y-%m-%d"),
                    symbol=symbol,
                    international=False
                )
                
                if response and "earningsCalendar" in response:
                    earnings_list = response["earningsCalendar"]
                    logger.info(f"✅ [EARNINGS] Found {len(earnings_list)} earnings records for {symbol}")
                    
                    # Filter to only include records for the specific symbol
                    symbol_earnings = [
                        earning for earning in earnings_list 
                        if earning.get("symbol", "").upper() == symbol.upper()
                    ]
                    
                    earnings_data[symbol] = symbol_earnings
                    logger.info(f"📊 [EARNINGS] {symbol}: {len(symbol_earnings)} earnings records")
                else:
                    logger.info(f"📭 [EARNINGS] No earnings data found for {symbol}")
                    earnings_data[symbol] = []
                    
            except Exception as e:
                logger.error(f"❌ [EARNINGS] Error fetching earnings for {symbol}: {e}")
                earnings_data[symbol] = []
        
        total_earnings = sum(len(earnings) for earnings in earnings_data.values())
        logger.info(f"🎯 [EARNINGS] Total earnings records fetched: {total_earnings} across {len(symbols)} symbols")
        
        return earnings_data

    async def get_earnings_for_symbol(
        self, 
        symbol: str, 
        from_date: Optional[date] = None, 
        to_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get earnings calendar data for a single symbol
        Returns 1 upcoming earnings and 3 previous earnings
        
        Args:
            symbol: Stock symbol to fetch earnings for
            from_date: Start date for earnings data
            to_date: End date for earnings data
            
        Returns:
            List of earnings data for the symbol (1 upcoming + 3 previous)
        """
        earnings_data = await self.get_earnings_calendar([symbol], from_date, to_date)
        return earnings_data.get(symbol, [])

    def format_earnings_data(self, raw_earnings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format raw earnings data from Finnhub to match our frontend structure
        Returns only 1 upcoming earnings and 3 previous earnings
        
        Args:
            raw_earnings: Raw earnings data from Finnhub API
            
        Returns:
            Formatted earnings data (1 upcoming + 3 previous)
        """
        formatted_earnings = []
        today = date.today()
        
        # Separate upcoming and past earnings
        upcoming_earnings = []
        past_earnings = []
        
        for earning in raw_earnings:
            try:
                earning_date = datetime.strptime(earning.get("date"), "%Y-%m-%d").date()
                
                formatted_earning = {
                    "date": earning.get("date"),
                    "epsActual": earning.get("epsActual"),
                    "epsEstimate": earning.get("epsEstimate"),
                    "hour": earning.get("hour", "amc"),  # Default to "amc"
                    "quarter": earning.get("quarter"),
                    "revenueActual": earning.get("revenueActual"),
                    "revenueEstimate": earning.get("revenueEstimate"),
                    "symbol": earning.get("symbol"),
                    "year": earning.get("year")
                }
                
                if earning_date > today:
                    upcoming_earnings.append(formatted_earning)
                else:
                    past_earnings.append(formatted_earning)
                    
            except Exception as e:
                logger.warning(f"⚠️ [EARNINGS] Error formatting earnings record: {e}")
                continue
        
        # Sort upcoming earnings by date (ascending - earliest first)
        upcoming_earnings.sort(key=lambda x: x["date"])
        
        # Sort past earnings by date (descending - most recent first)
        past_earnings.sort(key=lambda x: x["date"], reverse=True)
        
        # Take only 1 upcoming and 3 previous
        result = []
        
        # Add 1 upcoming earnings (if available)
        if upcoming_earnings:
            result.append(upcoming_earnings[0])
            logger.info(f"📅 [EARNINGS] Added 1 upcoming earnings: {upcoming_earnings[0]['date']}")
        
        # Add up to 3 previous earnings
        for i, past_earning in enumerate(past_earnings[:3]):
            result.append(past_earning)
            logger.info(f"📅 [EARNINGS] Added previous earnings {i+1}/3: {past_earning['date']}")
        
        logger.info(f"✅ [EARNINGS] Formatted {len(result)} earnings records (1 upcoming + {min(3, len(past_earnings))} previous)")
        return result

# Global service instance
_earnings_service = None

def get_earnings_service() -> EarningsService:
    """Get the global earnings service instance"""
    global _earnings_service
    if _earnings_service is None:
        _earnings_service = EarningsService()
    return _earnings_service
