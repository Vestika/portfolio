"""
Closing Price Module

A simplified module for fetching and managing stock prices and currency exchange rates.
Supports both US stocks (via Finnhub) and TASE stocks (via pymaya).
"""

from .service import ClosingPriceService
from .models import PriceResponse
from .config import settings

__all__ = ["ClosingPriceService", "PriceResponse", "settings"] 