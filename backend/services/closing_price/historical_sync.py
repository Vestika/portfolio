"""
Historical Price Synchronization Service

This module handles the periodic synchronization of stock prices from the in-memory
live cache to MongoDB's historical_prices time-series collection.

Runs every 3 hours with two stages:
- Stage 1: Fast cache transfer (in-memory -> MongoDB)
- Stage 2: Self-healing backfill for lagging/failed symbols
"""
import asyncio
import yfinance as yf
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional
from loguru import logger

from .database import db, ensure_connections
from .live_price_cache import get_live_price_cache
from .models import HistoricalPrice
from .stock_fetcher import FinnhubFetcher
from config import settings


class HistoricalSyncService:
    """Service for syncing live prices to historical data"""
    
    def __init__(self):
        self.live_cache = get_live_price_cache()
        self.finnhub_fetcher = FinnhubFetcher(settings.finnhub_api_key) if settings.finnhub_api_key else None
    
    async def run_daily_sync(self) -> Dict[str, Any]:
        """
        Main entry point for the cron job.
        Runs both Stage 1 (fast transfer) and Stage 2 (self-healing).
        
        Returns:
            Dictionary with sync statistics
        """
        logger.info("[HISTORICAL SYNC] Starting 3-hour historical price sync")
        
        try:
            await ensure_connections()
            
            # Stage 1: Fast cache transfer
            stage1_result = await self._stage1_fast_transfer()
            
            # Stage 2: Self-healing backfill
            stage2_result = await self._stage2_self_healing()
            
            # Combined results
            result = {
                "sync_timestamp": datetime.utcnow().isoformat(),
                "stage1": stage1_result,
                "stage2": stage2_result,
                "total_symbols_updated": stage1_result["success_count"] + stage2_result["success_count"],
                "total_errors": stage1_result["error_count"] + stage2_result["error_count"]
            }
            
            logger.info(f"[HISTORICAL SYNC] Completed - Updated {result['total_symbols_updated']} symbols, {result['total_errors']} errors")
            
            return result
            
        except Exception as e:
            logger.error(f"[HISTORICAL SYNC] Fatal error during sync: {e}")
            return {
                "sync_timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "stage1": {"success_count": 0, "error_count": 0},
                "stage2": {"success_count": 0, "error_count": 0}
            }
    
    async def _stage1_fast_transfer(self) -> Dict[str, Any]:
        """
        Stage 1: Fast Cache Transfer
        
        Transfer prices from in-memory cache to MongoDB for symbols that were
        successfully updated recently (within last 3 hours).
        
        Returns:
            Dictionary with stage statistics
        """
        logger.info("[STAGE 1] Starting fast cache transfer")
        
        try:
            # Define date ranges
            now = datetime.utcnow()
            three_hours_ago = now - timedelta(hours=3)
            
            # Use a consistent closing timestamp (4:00 PM ET = 20:00 UTC)
            closing_timestamp = now.replace(hour=20, minute=0, second=0, microsecond=0)
            
            # If current time is before 20:00 UTC, use yesterday's closing time
            if now.hour < 20:
                closing_timestamp = closing_timestamp - timedelta(days=1)
            
            # Get symbols that were updated recently (in last 3 hours)
            up_to_date_symbols = await db.database.tracked_symbols.find({
                "last_update": {"$gte": three_hours_ago}
            }).to_list(length=None)
            
            logger.info(f"[STAGE 1] Found {len(up_to_date_symbols)} up-to-date symbols")
            
            if not up_to_date_symbols:
                return {"success_count": 0, "error_count": 0, "message": "No up-to-date symbols"}
            
            # Get prices from in-memory cache
            documents_to_insert = []
            symbols_to_update = []
            
            for symbol_doc in up_to_date_symbols:
                symbol = symbol_doc["symbol"]
                live_data = self.live_cache.get(symbol)
                
                if live_data and live_data.get("price"):
                    # Check if this timestamp already exists (avoid duplicates)
                    existing = await db.database.historical_prices.find_one({
                        "symbol": symbol,
                        "timestamp": closing_timestamp
                    })
                    
                    if not existing:
                        # DEBUG: Log what we're about to insert
                        logger.debug(f"[STAGE 1] {symbol}: price from cache = {live_data['price']}")
                        
                        # Prepare document for insertion
                        documents_to_insert.append({
                            "symbol": symbol,
                            "timestamp": closing_timestamp,
                            "close": live_data["price"]
                        })
                        symbols_to_update.append(symbol)
            
            # Execute insert_many if we have documents
            if documents_to_insert:
                try:
                    result = await db.database.historical_prices.insert_many(
                        documents_to_insert,
                        ordered=False  # Continue even if some inserts fail
                    )
                    inserted_count = len(result.inserted_ids)
                    logger.info(f"[STAGE 1] Inserted {inserted_count} historical records")
                    
                    # Update last_update for successful symbols
                    await db.database.tracked_symbols.update_many(
                        {"symbol": {"$in": symbols_to_update}},
                        {"$set": {"last_update": now}}
                    )
                    
                    return {
                        "success_count": len(symbols_to_update),
                        "error_count": 0,
                        "inserted": inserted_count
                    }
                except Exception as e:
                    # Some duplicates might exist, but that's okay
                    logger.warning(f"[STAGE 1] Partial insert completed with duplicates: {e}")
                    
                    # Still update last_update for symbols we attempted
                    await db.database.tracked_symbols.update_many(
                        {"symbol": {"$in": symbols_to_update}},
                        {"$set": {"last_update": now}}
                    )
                    
                    return {
                        "success_count": len(symbols_to_update),
                        "error_count": 0,
                        "inserted": len(documents_to_insert),
                        "note": "Some documents may have been duplicates"
                    }
            else:
                return {"success_count": 0, "error_count": 0, "message": "No new prices to insert"}
            
        except Exception as e:
            logger.error(f"[STAGE 1] Error during fast transfer: {e}")
            return {"success_count": 0, "error_count": 1, "error": str(e)}
    
    async def _stage2_self_healing(self) -> Dict[str, Any]:
        """
        Stage 2: Self-Healing Backfill
        
        Backfill historical data for symbols that haven't been updated in a while
        (missing updates due to downtime, failures, etc.).
        
        Returns:
            Dictionary with stage statistics
        """
        logger.info("[STAGE 2] Starting self-healing backfill")
        
        try:
            now = datetime.utcnow()
            three_hours_ago = now - timedelta(hours=3)
            six_hours_ago = now - timedelta(hours=6)
            
            # Get symbols that need backfilling:
            # 1. No last_update (never synced)
            # 2. last_update older than 3 hours (lagging)
            # 3. last_update within last 6 hours BUT no historical data (recently tracked, needs initial population)
            
            # First, get symbols without last_update or old last_update
            query = {
                "$or": [
                    {"last_update": {"$lt": three_hours_ago}},
                    {"last_update": {"$exists": False}},
                    {"last_update": None}
                ]
            }
            lagging_symbols = await db.database.tracked_symbols.find(query).to_list(length=None)
            
            # Additionally, get recently tracked symbols that have no historical data
            recently_tracked = await db.database.tracked_symbols.find({
                "last_update": {"$gte": six_hours_ago, "$exists": True}
            }).to_list(length=None)
            
            # For recently tracked, check if they actually have historical data
            for symbol_doc in recently_tracked:
                symbol = symbol_doc["symbol"]
                has_data = await db.database.historical_prices.find_one({"symbol": symbol})
                if not has_data:
                    # No historical data despite being recently tracked - needs initial backfill
                    lagging_symbols.append(symbol_doc)
                    logger.info(f"[STAGE 2] {symbol} recently tracked but no historical data - will backfill")
            
            logger.info(f"[STAGE 2] Found {len(lagging_symbols)} symbols needing backfill")
            
            if not lagging_symbols:
                return {"success_count": 0, "error_count": 0, "message": "No lagging symbols"}
            
            success_count = 0
            error_count = 0
            
            # Process each lagging symbol individually
            for symbol_doc in lagging_symbols:
                symbol = symbol_doc["symbol"]
                market = symbol_doc.get("market", "US")
                
                try:
                    # Check how many historical records this symbol has
                    record_count = await db.database.historical_prices.count_documents({"symbol": symbol})
                    
                    # Determine start date for backfill
                    last_update = symbol_doc.get("last_update")
                    
                    # If symbol has < 50 records, fetch full year (it's incomplete!)
                    if record_count < 50:
                        start_date = (now - timedelta(days=365)).date()
                        logger.info(f"[STAGE 2] {symbol} has only {record_count} records, fetching full year")
                    elif not last_update:
                        # No previous update - get full year for initial population
                        start_date = (now - timedelta(days=365)).date()
                        logger.info(f"[STAGE 2] {symbol} never updated, fetching full year")
                    else:
                        # Has enough records, just fill the gap since last update
                        start_date = (last_update + timedelta(days=1)).date()
                        logger.info(f"[STAGE 2] {symbol} gap-filling from {start_date}")
                    
                    end_date = now.date()
                    
                    # Skip if start_date is after end_date (already up to date)
                    if start_date > end_date:
                        continue
                    
                    logger.info(f"[STAGE 2] Backfilling {symbol} from {start_date} to {end_date}")
                    
                    # Fetch historical data based on market type
                    historical_data = await self._fetch_historical_data(symbol, market, start_date, end_date)
                    
                    if historical_data:
                        # Insert historical data
                        await self._insert_historical_data(symbol, historical_data)
                        
                        # Update last_update for this symbol
                        latest_timestamp = max(data["timestamp"] for data in historical_data)
                        await db.database.tracked_symbols.update_one(
                            {"symbol": symbol},
                            {"$set": {"last_update": latest_timestamp}}
                        )
                        
                        success_count += 1
                        logger.info(f"[STAGE 2] Successfully backfilled {symbol}: {len(historical_data)} records")
                    else:
                        logger.warning(f"[STAGE 2] No historical data available for {symbol}")
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"[STAGE 2] Error backfilling {symbol}: {e}")
                    error_count += 1
            
            return {
                "success_count": success_count,
                "error_count": error_count,
                "total_processed": len(lagging_symbols)
            }
            
        except Exception as e:
            logger.error(f"[STAGE 2] Error during self-healing: {e}")
            return {"success_count": 0, "error_count": 1, "error": str(e)}
    
    async def _fetch_historical_data(
        self, 
        symbol: str, 
        market: str, 
        start_date: date, 
        end_date: date
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch historical data from appropriate source (yfinance or pymaya).
        
        Args:
            symbol: Stock symbol
            market: Market type (US, TASE, CURRENCY, CRYPTO)
            start_date: Start date
            end_date: End date
        
        Returns:
            List of historical price dicts with timestamp and close price
        """
        try:
            # Use pymaya for TASE symbols, yfinance for others
            if market == "TASE" or symbol.isdigit():
                return await self._fetch_tase_historical(symbol, start_date, end_date)
            else:
                return await self._fetch_yfinance_historical(symbol, start_date, end_date)
                
        except Exception as e:
            logger.error(f"[FETCH HISTORICAL] Error fetching historical data for {symbol}: {e}")
            return None
    
    async def _fetch_yfinance_historical(
        self,
        symbol: str,
        start_date: date,
        end_date: date
    ) -> Optional[List[Dict[str, Any]]]:
        """Fetch historical data from yfinance"""
        try:
            # Handle currency symbols (FX:XXX format)
            yf_symbol = symbol
            if symbol.startswith('FX:'):
                # Convert FX:USD to USDILS=X, FX:EUR to EURILS=X, etc.
                currency_code = symbol[3:]  # Remove "FX:" prefix
                
                if currency_code == 'ILS':
                    # ILS in ILS terms is always 1.0, return flat data
                    historical_data = []
                    current_date = start_date
                    while current_date <= end_date:
                        timestamp = datetime.combine(current_date, datetime.min.time()).replace(hour=20, minute=0)
                        historical_data.append({
                            "timestamp": timestamp,
                            "close": 1.0
                        })
                        current_date += timedelta(days=1)
                    logger.info(f"[FETCH HISTORICAL] Generated {len(historical_data)} data points for {symbol} (base currency)")
                    return historical_data
                else:
                    # For other currencies, fetch XXX/ILS rate
                    # yfinance format: XXXILS=X (e.g., USDILS=X)
                    yf_symbol = f"{currency_code}ILS=X"
                    logger.info(f"[FETCH HISTORICAL] Converting {symbol} to yfinance format: {yf_symbol}")
            
            # Run yfinance in executor to avoid blocking
            def _fetch_sync():
                # Add 1 day to end_date because yfinance end is exclusive
                end_inclusive = end_date + timedelta(days=1)
                data = yf.download(yf_symbol, start=start_date, end=end_inclusive, progress=False, auto_adjust=True)
                return data
            
            loop = asyncio.get_event_loop()
            data = await asyncio.wait_for(
                loop.run_in_executor(None, _fetch_sync),
                timeout=10.0  # 10 second timeout
            )
            
            if data.empty:
                logger.warning(f"[FETCH HISTORICAL] No data from yfinance for {symbol}")
                return None
            
            # Parse the data into our format
            historical_data = []
            
            if "Close" in data.columns:
                prices = data["Close"].dropna()
                
                for dt in prices.index:
                    # Convert to datetime at market close time (20:00 UTC = 4:00 PM ET)
                    if hasattr(dt, 'date'):
                        price_date = dt.date()
                    else:
                        price_date = dt
                    
                    timestamp = datetime.combine(price_date, datetime.min.time()).replace(hour=20, minute=0)
                    
                    price_value = prices.loc[dt]
                    if hasattr(price_value, 'iloc'):
                        price_value = float(price_value.iloc[0])
                    else:
                        price_value = float(price_value)
                    
                    historical_data.append({
                        "timestamp": timestamp,
                        "close": round(price_value, 2)
                    })
            
            logger.info(f"[FETCH HISTORICAL] Retrieved {len(historical_data)} data points for {symbol} from yfinance")
            return historical_data if historical_data else None
            
        except asyncio.TimeoutError:
            logger.warning(f"[FETCH HISTORICAL] Timeout fetching data for {symbol}")
            return None
        except Exception as e:
            logger.error(f"[FETCH HISTORICAL] Error fetching yfinance data for {symbol}: {e}")
            return None
    
    async def _fetch_tase_historical(
        self,
        symbol: str,
        start_date: date,
        end_date: date
    ) -> Optional[List[Dict[str, Any]]]:
        """Fetch historical data from pymaya for TASE symbols"""
        try:
            from pymaya.maya import Maya
            
            logger.info(f"[FETCH HISTORICAL] Fetching TASE symbol {symbol} using pymaya")
            
            # Run pymaya in executor to avoid blocking
            def _fetch_sync():
                maya = Maya()
                # pymaya uses security_id (numeric) and expects date object
                price_history = list(maya.get_price_history(security_id=str(symbol), from_date=start_date))
                return price_history
            
            loop = asyncio.get_event_loop()
            price_history = await asyncio.wait_for(
                loop.run_in_executor(None, _fetch_sync),
                timeout=10.0
            )
            
            if not price_history:
                logger.warning(f"[FETCH HISTORICAL] No data from pymaya for {symbol}")
                return None
            
            # Parse pymaya data into our format
            # Note: pymaya returns different formats for stocks vs bonds/funds
            historical_data = []
            
            for entry in reversed(price_history):  # pymaya returns newest first
                trade_date_str = entry.get('TradeDate')
                if not trade_date_str:
                    continue
                
                # Try to get price (different fields for stocks vs bonds)
                price_raw = entry.get('CloseRate') or entry.get('SellPrice')
                if not price_raw:
                    continue
                
                try:
                    # Parse date - handle both formats (DD/MM/YYYY and ISO datetime)
                    if 'T' in str(trade_date_str):
                        # ISO datetime format (bonds/funds): "2025-11-13T00:00:00"
                        trade_date = datetime.fromisoformat(str(trade_date_str).replace('T00:00:00', '')).date()
                    else:
                        # DD/MM/YYYY format (stocks): "13/11/2025"
                        trade_date = datetime.strptime(str(trade_date_str), '%d/%m/%Y').date()
                    
                    # Convert to timestamp at market close
                    timestamp = datetime.combine(trade_date, datetime.min.time()).replace(hour=20, minute=0)
                    
                    # Price might be in agorot (1/100 shekel) or regular shekel
                    # If > 1000, it's likely in agorot
                    price = float(price_raw)
                    if price > 1000:
                        price = price / 100
                    
                    historical_data.append({
                        "timestamp": timestamp,
                        "close": round(price, 2)
                    })
                    
                except Exception as parse_error:
                    logger.debug(f"[FETCH HISTORICAL] Error parsing entry for {symbol}: {parse_error}")
                    continue
            
            logger.info(f"[FETCH HISTORICAL] Retrieved {len(historical_data)} data points for {symbol} from pymaya")
            return historical_data if historical_data else None
            
        except asyncio.TimeoutError:
            logger.warning(f"[FETCH HISTORICAL] Timeout fetching pymaya data for {symbol}")
            return None
        except Exception as e:
            logger.error(f"[FETCH HISTORICAL] Error fetching pymaya data for {symbol}: {e}")
            return None
    
    async def _insert_historical_data(self, symbol: str, historical_data: List[Dict[str, Any]]) -> None:
        """
        Insert historical data into MongoDB time-series collection.
        
        Note: Time-series collections don't support upsert, so we check for existing
        documents first and only insert new ones.
        
        Args:
            symbol: Stock symbol
            historical_data: List of dicts with timestamp and close price
        """
        try:
            # Get existing timestamps for this symbol to avoid duplicates
            existing_cursor = db.database.historical_prices.find(
                {"symbol": symbol},
                {"timestamp": 1}
            )
            existing_timestamps = {doc["timestamp"] for doc in await existing_cursor.to_list(length=None)}
            
            # Filter out documents that already exist
            documents_to_insert = []
            for data_point in historical_data:
                if data_point["timestamp"] not in existing_timestamps:
                    documents_to_insert.append({
                        "symbol": symbol,
                        "timestamp": data_point["timestamp"],
                        "close": data_point["close"]
                    })
            
            # Insert only new documents
            if documents_to_insert:
                result = await db.database.historical_prices.insert_many(
                    documents_to_insert,
                    ordered=False  # Continue even if some inserts fail (duplicates)
                )
                inserted_count = len(result.inserted_ids)
                logger.info(f"[INSERT HISTORICAL] {symbol}: inserted {inserted_count} new records")
            else:
                logger.info(f"[INSERT HISTORICAL] {symbol}: all {len(historical_data)} records already exist")
                
        except Exception as e:
            logger.error(f"[INSERT HISTORICAL] Error inserting data for {symbol}: {e}")
            raise
    
    async def backfill_new_symbol(self, symbol: str, market: str = "US") -> Dict[str, Any]:
        """
        Backfill historical data for a newly added symbol (Logic 2).
        
        This is called when a user adds a new symbol to their portfolio.
        
        Args:
            symbol: Stock symbol to backfill
            market: Market type (US, TASE, CURRENCY, CRYPTO)
        
        Returns:
            Dictionary with backfill results
        """
        logger.info(f"[BACKFILL NEW] Starting backfill for new symbol: {symbol}")
        
        try:
            await ensure_connections()
            
            # Check if symbol already exists in tracked_symbols
            existing = await db.database.tracked_symbols.find_one({"symbol": symbol})
            
            # Check if symbol has sufficient historical data (not just tracked)
            if existing:
                # Count how many historical records exist
                record_count = await db.database.historical_prices.count_documents({"symbol": symbol})
                
                # If we have more than 200 records (approximately 1 year), consider it complete
                if record_count >= 200:
                    logger.info(f"[BACKFILL NEW] Symbol {symbol} already has sufficient data ({record_count} records)")
                    return {
                        "status": "already_tracked",
                        "symbol": symbol,
                        "message": f"Symbol already has {record_count} historical records"
                    }
                else:
                    logger.info(f"[BACKFILL NEW] Symbol {symbol} only has {record_count} records, backfilling full year")
            else:
                logger.info(f"[BACKFILL NEW] Symbol {symbol} not yet tracked, backfilling")
            
            # Fetch 1 year of historical data
            one_year_ago = (datetime.utcnow() - timedelta(days=365)).date()
            today = datetime.utcnow().date()
            
            historical_data = await self._fetch_historical_data(symbol, market, one_year_ago, today)
            
            if not historical_data:
                logger.warning(f"[BACKFILL NEW] No historical data available for {symbol}")
                return {
                    "status": "no_data",
                    "symbol": symbol,
                    "message": "No historical data available"
                }
            
            # Insert historical data
            await self._insert_historical_data(symbol, historical_data)
            
            # Add to tracked_symbols or update existing
            now = datetime.utcnow()
            await db.database.tracked_symbols.update_one(
                {"symbol": symbol},
                {
                    "$set": {
                        "symbol": symbol,
                        "market": market,
                        "last_update": now,
                        "last_queried_at": now
                    },
                    "$setOnInsert": {
                        "added_at": now
                    }
                },
                upsert=True
            )
            
            logger.info(f"[BACKFILL NEW] Successfully backfilled {symbol}: {len(historical_data)} records")
            
            return {
                "status": "success",
                "symbol": symbol,
                "records_inserted": len(historical_data),
                "date_range": {
                    "start": historical_data[0]["timestamp"].isoformat(),
                    "end": historical_data[-1]["timestamp"].isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"[BACKFILL NEW] Error backfilling {symbol}: {e}")
            return {
                "status": "error",
                "symbol": symbol,
                "error": str(e)
            }
    
    async def backfill_existing_symbols(self, days: int = 365) -> Dict[str, Any]:
        """
        One-time migration: Backfill historical data for all existing tracked symbols.
        
        This should be called once to populate historical data for symbols already
        in the database.
        
        Args:
            days: Number of days of history to fetch (default: 365)
        
        Returns:
            Dictionary with migration results
        """
        logger.info(f"[MIGRATION] Starting backfill for existing tracked symbols ({days} days)")
        
        try:
            await ensure_connections()
            
            # Get all tracked symbols
            all_symbols = await db.database.tracked_symbols.find({}).to_list(length=None)
            
            logger.info(f"[MIGRATION] Found {len(all_symbols)} tracked symbols")
            
            success_count = 0
            error_count = 0
            skipped_count = 0
            
            for symbol_doc in all_symbols:
                symbol = symbol_doc["symbol"]
                market = symbol_doc.get("market", "US")
                
                try:
                    # Check if we already have recent historical data
                    recent_data = await db.database.historical_prices.find_one(
                        {"symbol": symbol},
                        sort=[("timestamp", -1)]
                    )
                    
                    if recent_data:
                        last_timestamp = recent_data["timestamp"]
                        days_old = (datetime.utcnow() - last_timestamp).days
                        
                        if days_old < 7:
                            logger.info(f"[MIGRATION] Skipping {symbol} - has recent data ({days_old} days old)")
                            skipped_count += 1
                            continue
                    
                    # Fetch historical data
                    start_date = (datetime.utcnow() - timedelta(days=days)).date()
                    end_date = datetime.utcnow().date()
                    
                    historical_data = await self._fetch_historical_data(symbol, market, start_date, end_date)
                    
                    if historical_data:
                        await self._insert_historical_data(symbol, historical_data)
                        
                        # Update last_update
                        latest_timestamp = max(data["timestamp"] for data in historical_data)
                        await db.database.tracked_symbols.update_one(
                            {"symbol": symbol},
                            {"$set": {"last_update": latest_timestamp}}
                        )
                        
                        success_count += 1
                        logger.info(f"[MIGRATION] Backfilled {symbol}: {len(historical_data)} records")
                    else:
                        error_count += 1
                        logger.warning(f"[MIGRATION] No data for {symbol}")
                    
                    # Add small delay to avoid rate limiting
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"[MIGRATION] Error backfilling {symbol}: {e}")
                    error_count += 1
            
            result = {
                "status": "completed",
                "total_symbols": len(all_symbols),
                "success_count": success_count,
                "error_count": error_count,
                "skipped_count": skipped_count
            }
            
            logger.info(f"[MIGRATION] Completed: {success_count} success, {error_count} errors, {skipped_count} skipped")
            
            return result
            
        except Exception as e:
            logger.error(f"[MIGRATION] Fatal error during migration: {e}")
            return {
                "status": "error",
                "error": str(e),
                "success_count": 0,
                "error_count": 0,
                "skipped_count": 0
            }


# Global singleton instance
_sync_service: Optional[HistoricalSyncService] = None


def get_sync_service() -> HistoricalSyncService:
    """Get the global historical sync service instance"""
    global _sync_service
    if _sync_service is None:
        _sync_service = HistoricalSyncService()
        logger.info("[HISTORICAL SYNC] Initialized sync service")
    return _sync_service

