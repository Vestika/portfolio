"""Market data endpoints"""
import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.auth import get_current_user, get_current_user_or_anonymous
from core.database import db_manager
from services.closing_price.price_manager import PriceManager
from services.closing_price.historical_sync import get_sync_service
from services.closing_price.live_price_updater import get_updater_service
from services.closing_price.live_price_cache import get_live_price_cache

# Create router for this module
router = APIRouter()

logger = logging.Logger(__name__)


# Request models
class BackfillSymbolRequest(BaseModel):
    symbol: str
    market: str = "US"

@router.get("/market-status")
async def get_market_status(user=Depends(get_current_user)):
    """Return both US and TASE market open/closed status."""
    manager = PriceManager()
    return await manager.get_market_status()


@router.post("/symbols/populate")
async def populate_symbols_api(
    force: bool = Query(False, description="Force update all symbols, bypassing checksum validation"),
    symbol_types: Optional[List[str]] = Query(None, description="Specific symbol types to update (US, TASE, CURRENCY, CRYPTO)")
) -> dict[str, Any]:
    """
    API endpoint to populate the symbols collection using live APIs.
    - Uses Finnhub.io API for NYSE and NASDAQ securities
    - Uses PyMaya API for TASE securities
    - Includes currencies and crypto
    - Supports checksum-based incremental updates
    """
    try:
        # Import the consolidated populate_symbols function
        from populate_symbols import populate_symbols

        # Call the consolidated function
        result = await populate_symbols(force=force, symbol_types=symbol_types)

        # Get sample symbols for response
        sample_symbols = []
        if result["total_symbols"] > 0:
            collection = db_manager.get_collection("symbols")
            sample_cursor = collection.find({"is_active": True}).limit(5)
            async for doc in sample_cursor:
                sample_symbols.append({
                    "symbol": doc["symbol"],
                    "name": doc["name"],
                    "symbol_type": doc["symbol_type"],
                    "currency": doc["currency"],
                    "market": doc.get("market", ""),
                    "search_terms": doc.get("search_terms", [])[:3]  # Limit to first 3 terms
                })
        
        return {
            "success": True,
            "message": f"Symbols population completed. Updated: {result['updated_types']}, Skipped: {result['skipped_types']}",
            "stats": {
                "total_symbols": result["total_symbols"],
                "updated_types": result["updated_types"],
                "skipped_types": result["skipped_types"],
                "error_types": result["error_types"]
            },
            "details": result["details"],
            "sample_symbols": sample_symbols
        }

    except Exception as e:
        logger.error(f"Error populating symbols via API: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to populate symbols: {str(e)}")


@router.post("/symbols/cleanup")
async def cleanup_duplicate_symbols_api() -> dict[str, Any]:
    """
    Admin endpoint to clean up duplicate symbols in the database.
    Use this to fix data quality issues caused by incomplete clearing.
    """
    try:
        # Import the cleanup function
        from populate_symbols import cleanup_duplicate_symbols
        
        # Run the cleanup
        cleanup_stats = await cleanup_duplicate_symbols()
        
        return {
            "success": True,
            "message": f"Symbol cleanup completed. Removed {cleanup_stats['duplicates_removed']} duplicates.",
            "stats": cleanup_stats
        }
        
    except Exception as e:
        logger.error(f"Error during symbol cleanup via API: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup symbols: {str(e)}")


# ============================================================================
# HISTORICAL PRICE CACHING ENDPOINTS
# ============================================================================

@router.get("/cache/status")
async def get_cache_status() -> dict[str, Any]:
    """
    Get status of the historical price caching system.
    
    Returns:
        - Live cache statistics
        - Number of symbols with historical data
        - Last sync information
    """
    try:
        cache = get_live_price_cache()
        cache_stats = cache.get_stats()
        
        # Get historical data stats from MongoDB
        from services.closing_price.database import db, ensure_connections
        await ensure_connections()
        
        # Count unique symbols in historical_prices
        try:
            pipeline = [
                {"$group": {"_id": "$symbol"}},
                {"$count": "total"}
            ]
            result_list = await db.database.historical_prices.aggregate(pipeline).to_list(length=1)
            historical_symbols_count = result_list[0]["total"] if result_list else 0
        except Exception as agg_error:
            logger.warning(f"Error counting historical symbols: {agg_error}")
            # Fallback: count with distinct
            try:
                distinct_symbols = await db.database.historical_prices.distinct("symbol")
                historical_symbols_count = len(distinct_symbols)
            except:
                historical_symbols_count = 0
        
        # Get sample of oldest and newest historical data
        oldest = await db.database.historical_prices.find_one(sort=[("timestamp", 1)])
        newest = await db.database.historical_prices.find_one(sort=[("timestamp", -1)])
        
        return {
            "live_cache": cache_stats,
            "historical_data": {
                "symbols_with_history": historical_symbols_count,
                "oldest_data": oldest["timestamp"].isoformat() if oldest else None,
                "newest_data": newest["timestamp"].isoformat() if newest else None
            },
            "status": "healthy"
        }
        
    except Exception as e:
        logger.error(f"Error getting cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")


@router.post("/cache/refresh-live")
async def refresh_live_prices(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Manually trigger a live price update cycle.
    
    This forces an immediate update of all tracked symbols in the live cache.
    """
    try:
        updater = get_updater_service()
        result = await updater.update_once()
        
        return {
            "success": True,
            "message": f"Live cache refreshed: {result['updated']} symbols updated",
            "stats": result
        }
        
    except Exception as e:
        logger.error(f"Error refreshing live prices: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh live prices: {str(e)}")


@router.post("/cache/sync-historical")
async def sync_historical_prices(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Manually trigger a historical price sync (cron job logic).
    
    This runs both Stage 1 (fast transfer) and Stage 2 (self-healing).
    """
    try:
        sync_service = get_sync_service()
        result = await sync_service.run_daily_sync()
        
        return {
            "success": True,
            "message": f"Historical sync completed: {result['total_symbols_updated']} symbols updated",
            "stats": result
        }
        
    except Exception as e:
        logger.error(f"Error syncing historical prices: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync historical prices: {str(e)}")


@router.post("/cache/backfill-symbol")
async def backfill_symbol(request: BackfillSymbolRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Backfill historical data for a specific symbol.
    
    This is useful when adding a new symbol or re-fetching data for a symbol.
    """
    try:
        sync_service = get_sync_service()
        result = await sync_service.backfill_new_symbol(request.symbol, request.market)
        
        if result["status"] == "success":
            return {
                "success": True,
                "message": f"Backfilled {request.symbol}: {result.get('records_inserted', 0)} records",
                "stats": result
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Backfill failed"),
                "stats": result
            }
        
    except Exception as e:
        logger.error(f"Error backfilling symbol {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to backfill symbol: {str(e)}")


@router.post("/cache/backfill-all")
async def backfill_all_symbols(
    days: int = Query(default=365, description="Number of days of history to backfill"),
    user=Depends(get_current_user)
) -> dict[str, Any]:
    """
    One-time migration: Backfill historical data for all tracked symbols.
    
    This should be run once to populate historical data for existing symbols.
    Use with caution - may take several minutes depending on number of symbols.
    """
    try:
        sync_service = get_sync_service()
        
        logger.info(f"Starting backfill for all symbols ({days} days)")
        result = await sync_service.backfill_existing_symbols(days)
        
        return {
            "success": True,
            "message": f"Backfill completed: {result['success_count']} symbols processed",
            "stats": result
        }
        
    except Exception as e:
        logger.error(f"Error backfilling all symbols: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to backfill all symbols: {str(e)}")


@router.get("/cache/historical/{symbol}")
async def get_symbol_historical(
    symbol: str,
    days: int = Query(default=7, description="Number of days of history")
) -> dict[str, Any]:
    """
    Get historical prices for a specific symbol from cache.
    
    This retrieves pre-cached data from MongoDB (very fast!).
    """
    try:
        # Use the existing price_manager from closing_price service
        from services.closing_price.service import get_global_service
        
        service = get_global_service()
        result = await service.get_historical_prices([symbol], days)
        
        if result and symbol in result:
            return {
                "symbol": symbol,
                "days": days,
                "data": result[symbol],
                "count": len(result[symbol])
            }
        else:
            return {
                "symbol": symbol,
                "days": days,
                "data": [],
                "count": 0,
                "message": "No historical data found"
            }
        
    except Exception as e:
        logger.error(f"Error getting historical data for {symbol}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get historical data: {str(e)}")


@router.get("/cache/scheduler/status")
async def get_scheduler_status() -> dict[str, Any]:
    """
    Get status of the scheduled jobs.
    
    Returns information about the historical sync and live update jobs.
    """
    try:
        from services.closing_price.scheduler import get_scheduler_service
        
        scheduler = get_scheduler_service()
        jobs = scheduler.get_jobs()
        
        return {
            "scheduler_running": scheduler.scheduler is not None and scheduler.scheduler.running,
            "jobs": jobs
        }
        
    except Exception as e:
        logger.error(f"Error getting scheduler status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler status: {str(e)}")