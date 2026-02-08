"""Market data endpoints"""
import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from core.auth import get_current_user, get_current_user_or_anonymous
from core.database import db_manager
from services.closing_price.price_manager import PriceManager
from services.closing_price.live_price_updater import get_updater_service
from services.closing_price.live_price_cache import get_live_price_cache

# Create router for this module
router = APIRouter()

logger = logging.Logger(__name__)


# Request models
class BackfillSymbolRequest(BaseModel):
    symbol: str
    market: str = "US"
    force: bool = False  # Force re-fetch even if data exists

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
async def get_cache_status(request: Request) -> dict[str, Any]:
    """
    Get status of the historical price caching system.

    Returns:
        - Live cache statistics
        - Number of symbols with historical data (from market_data reader)
        - Writer queue status
    """
    try:
        cache = get_live_price_cache()
        cache_stats = cache.get_stats()

        # Get market_data reader/writer stats
        market_reader = getattr(request.app.state, 'market_reader', None)
        market_writer = getattr(request.app.state, 'market_writer', None)

        reader_stats = {}
        if market_reader:
            last_dates = await market_reader.get_last_dates()
            tracked = await market_reader.get_tracked_symbols()
            reader_stats = {
                "symbols_in_ram": len(last_dates),
                "tracked_symbols": len(tracked),
            }

        writer_stats = {}
        if market_writer:
            writer_stats = await market_writer.get_queue_status()

        return {
            "live_cache": cache_stats,
            "market_data_reader": reader_stats,
            "market_data_writer": writer_stats,
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
async def sync_historical_prices(request: Request, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Manually trigger a historical price backfill via the market_data writer.
    """
    try:
        market_writer = getattr(request.app.state, 'market_writer', None)
        if not market_writer:
            raise HTTPException(status_code=503, detail="Market data writer not available")

        await market_writer.force_backfill()
        status = await market_writer.get_queue_status()

        return {
            "success": True,
            "message": f"Historical backfill enqueued: {status['queue_size']} tasks in queue",
            "stats": status
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing historical prices: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync historical prices: {str(e)}")


@router.post("/cache/backfill-symbol")
async def backfill_symbol(request: Request, req: BackfillSymbolRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Backfill historical data for a specific symbol via the market_data writer.
    """
    try:
        market_writer = getattr(request.app.state, 'market_writer', None)
        if not market_writer:
            raise HTTPException(status_code=503, detail="Market data writer not available")

        await market_writer.add_symbols([req.symbol], [req.market])
        status = await market_writer.get_queue_status()

        return {
            "success": True,
            "message": f"Backfill enqueued for {req.symbol} ({req.market})",
            "stats": status
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error backfilling symbol {req.symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to backfill symbol: {str(e)}")


@router.post("/cache/backfill-all")
async def backfill_all_symbols(
    request: Request,
    days: int = Query(default=365, description="Number of days of history to backfill"),
    user=Depends(get_current_user)
) -> dict[str, Any]:
    """
    Force re-fetch historical data for ALL tracked symbols via the market_data writer.
    """
    try:
        market_writer = getattr(request.app.state, 'market_writer', None)
        if not market_writer:
            raise HTTPException(status_code=503, detail="Market data writer not available")

        await market_writer.force_fetch_all()
        status = await market_writer.get_queue_status()

        return {
            "success": True,
            "message": f"Backfill-all enqueued: {status['queue_size']} tasks in queue",
            "stats": status
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error backfilling all symbols: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to backfill all symbols: {str(e)}")


@router.get("/cache/historical/{symbol}")
async def get_symbol_historical(
    request: Request,
    symbol: str,
    days: int = Query(default=7, description="Number of days of history")
) -> dict[str, Any]:
    """
    Get historical prices for a specific symbol from the market_data reader (RAM).
    """
    try:
        market_reader = getattr(request.app.state, 'market_reader', None)
        if market_reader:
            result = await market_reader.get_historical_prices([symbol], days)
        else:
            # Fallback to old service
            from services.closing_price.service import get_global_service
            service = get_global_service()
            result = await service.get_historical_prices([symbol], days)

        if result and symbol in result and result[symbol]:
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
