from fastapi import APIRouter, HTTPException, Depends, Path, Query
from loguru import logger
from typing import Any, Optional

from ..models import PriceResponse, TrackSymbolsRequest, RefreshResponse
from ..services.price_manager import PriceManager
from ..services.currency_service import currency_service

router = APIRouter()
price_manager = PriceManager()


def get_price_manager() -> PriceManager:
    """Dependency to get price manager instance"""
    return PriceManager()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "closing-price-service"}


@router.get("/prices/{symbol}", response_model=PriceResponse)
async def get_price(symbol: str = Path(..., description="Stock symbol to fetch price for")):
    """Get latest price for a specific symbol"""
    try:
        price = await price_manager.get_price(symbol.upper())
        if not price:
            raise HTTPException(status_code=404, detail=f"Could not fetch price for symbol: {symbol}")
        return price
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_price endpoint for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/prices", response_model=list[PriceResponse])
async def get_tracked_prices():
    """Get latest prices for all tracked symbols"""
    try:
        prices = await price_manager.get_tracked_prices()
        return prices
    except Exception as e:
        logger.error(f"Error in get_tracked_prices endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/track")
async def track_symbols(request: TrackSymbolsRequest):
    """Add symbols to tracking list"""
    try:
        results = await price_manager.track_symbols(request.symbols)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error in track_symbols endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_tracked():
    """Manually refresh all tracked symbols"""
    try:
        result = await price_manager.refresh_tracked_symbols()
        return RefreshResponse(**result)
    except Exception as e:
        logger.error(f"Error in refresh_tracked endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Currency exchange rate endpoints
@router.get("/currency/{from_currency}/{to_currency}")
async def get_exchange_rate(
    from_currency: str = Path(..., description="Source currency code (e.g., USD)"),
    to_currency: str = Path(..., description="Target currency code (e.g., ILS)")
):
    """Get exchange rate between two currencies"""
    try:
        rate = await currency_service.get_exchange_rate(from_currency, to_currency)
        if rate is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Could not fetch exchange rate for {from_currency}/{to_currency}"
            )
        
        return {
            "from_currency": from_currency.upper(),
            "to_currency": to_currency.upper(),
            "rate": rate,
            "description": f"1 {from_currency.upper()} = {rate} {to_currency.upper()}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting exchange rate {from_currency}/{to_currency}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/currency/{from_currency}/{to_currency}/info")
async def get_currency_info(
    from_currency: str = Path(..., description="Source currency code (e.g., USD)"),
    to_currency: str = Path(..., description="Target currency code (e.g., ILS)")
):
    """Get detailed currency information including rate, timestamp, and source"""
    try:
        info = await currency_service.get_currency_info(from_currency, to_currency)
        if info is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Could not fetch currency info for {from_currency}/{to_currency}"
            )
        
        return info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting currency info {from_currency}/{to_currency}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/currency/supported")
async def get_supported_currencies():
    """Get list of supported currencies"""
    try:
        currencies = await currency_service.get_supported_currencies()
        if currencies is None:
            raise HTTPException(status_code=503, detail="Currency service unavailable")
        
        return {
            "currencies": currencies,
            "count": len(currencies),
            "major_pairs": {
                "USD_EUR": "US Dollar to Euro",
                "USD_GBP": "US Dollar to British Pound",
                "USD_JPY": "US Dollar to Japanese Yen",
                "USD_ILS": "US Dollar to Israeli Shekel",
                "EUR_USD": "Euro to US Dollar"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting supported currencies: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Convenience endpoint for common currency pairs
@router.get("/currency/usd-ils")
async def get_usd_ils_rate():
    """Get current USD to ILS exchange rate (convenience endpoint)"""
    try:
        rate = await currency_service.get_exchange_rate("USD", "ILS")
        if rate is None:
            raise HTTPException(status_code=404, detail="Could not fetch USD/ILS exchange rate")
        
        return {
            "from_currency": "USD",
            "to_currency": "ILS",
            "rate": rate,
            "description": f"1 USD = {rate} ILS"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting USD/ILS rate: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/currency/eur-usd")
async def get_eur_usd_rate():
    """Get current EUR to USD exchange rate (convenience endpoint)"""
    try:
        rate = await currency_service.get_exchange_rate("EUR", "USD")
        if rate is None:
            raise HTTPException(status_code=404, detail="Could not fetch EUR/USD exchange rate")
        
        return {
            "from_currency": "EUR",
            "to_currency": "USD",
            "rate": rate,
            "description": f"1 EUR = {rate} USD"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting EUR/USD rate: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")