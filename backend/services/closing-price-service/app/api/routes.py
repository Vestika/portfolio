from fastapi import APIRouter, HTTPException, Depends
from loguru import logger
from typing import Any

from ..models import PriceResponse, TrackSymbolsRequest, RefreshResponse
from ..services.price_manager import PriceManager

router = APIRouter()


def get_price_manager() -> PriceManager:
    """Dependency to get price manager instance"""
    return PriceManager()


@router.get("/prices/{symbol}", response_model=PriceResponse)
async def get_price(
    symbol: str,
    price_manager: PriceManager = Depends(get_price_manager)
) -> PriceResponse:
    """
    Get the latest closing price for a specific symbol.
    
    - **symbol**: Stock symbol (e.g., 'AAPL' for US stocks or '1101534' for TASE stocks)
    
    This endpoint will:
    1. Check cache first
    2. Fall back to database if cache miss
    3. Fetch fresh data if needed (lazy loading)
    4. Update tracking information
    """
    try:
        price = await price_manager.get_price(symbol.upper())
        if not price:
            raise HTTPException(
                status_code=404,
                detail=f"Could not fetch price for symbol: {symbol}"
            )
        return price
        
    except Exception as e:
        logger.error(f"Error in get_price endpoint for {symbol}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while fetching price for {symbol}"
        )


@router.get("/prices", response_model=list[PriceResponse])
async def get_tracked_prices(
    price_manager: PriceManager = Depends(get_price_manager)
) -> list[PriceResponse]:
    """
    Get the latest closing prices for all tracked symbols.
    
    Returns a list of prices for all symbols currently being tracked.
    """
    try:
        prices = await price_manager.get_tracked_prices()
        return prices
        
    except Exception as e:
        logger.error(f"Error in get_tracked_prices endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching tracked prices"
        )


@router.post("/prices", response_model=dict[str, str])
async def track_symbols(
    request: TrackSymbolsRequest,
    price_manager: PriceManager = Depends(get_price_manager)
) -> dict[str, str]:
    """
    Add symbols to the tracking list.
    
    - **symbols**: List of stock symbols to track
    
    Returns the status of each symbol:
    - "added": Symbol was successfully added to tracking
    - "already_tracked": Symbol was already being tracked
    - "error: <message>": An error occurred while adding the symbol
    """
    try:
        if not request.symbols:
            raise HTTPException(
                status_code=400,
                detail="No symbols provided"
            )
        
        # Convert symbols to uppercase for consistency
        symbols = [symbol.upper() for symbol in request.symbols]
        results = await price_manager.track_symbols(symbols)
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in track_symbols endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while tracking symbols"
        )


@router.post("/prices/refresh", response_model=RefreshResponse)
async def refresh_prices(
    price_manager: PriceManager = Depends(get_price_manager)
) -> RefreshResponse:
    """
    Manually refresh prices for all tracked symbols.
    
    This endpoint will:
    1. Fetch fresh prices for all tracked symbols
    2. Update the database and cache
    3. Clean up old tracking records (symbols not queried for 7+ days)
    
    Returns a summary of the refresh operation:
    - refreshed_count: Number of symbols successfully refreshed
    - not_refreshed_count: Number of symbols not refreshed (no new data available)
    - failed_symbols: List of symbols that failed to refresh due to errors
    """
    try:
        result = await price_manager.refresh_tracked_symbols()
        
        return RefreshResponse(
            message=result["message"],
            refreshed_count=result["refreshed_count"],
            not_refreshed_count=result["not_refreshed_count"],
            failed_symbols=result["failed_symbols"]
        )
        
    except Exception as e:
        logger.error(f"Error in refresh_prices endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while refreshing prices"
        )


@router.get("/health")
async def health_check() -> dict[str, str]:
    """
    Health check endpoint for monitoring.
    """
    return {
        "status": "healthy",
        "service": "closing-price-service",
    }