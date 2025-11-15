"""
Closing Price Module

A simplified module for fetching and managing stock prices and currency exchange rates.
Supports both US stocks (via Finnhub) and TASE stocks (via pymaya).
"""
from config import settings
from .service import ClosingPriceService
from .models import PriceResponse, HistoricalPrice, TrackedSymbol

__all__ = ["ClosingPriceService", "PriceResponse", "HistoricalPrice", "TrackedSymbol", "settings"] 