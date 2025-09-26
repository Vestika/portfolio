"""Market data endpoints"""
import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import get_current_user
from core.database import db_manager
from services.closing_price.price_manager import PriceManager

# Create router for this module
router = APIRouter()

logger = logging.Logger(__name__)

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