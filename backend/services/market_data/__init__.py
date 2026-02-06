"""Market data service -- decoupled reader/writer architecture."""

from .config import MarketDataConfig, RateLimitConfig
from .lifecycle import init_market_data_service, shutdown_market_data_service
from .models import HistoricalBar, SymbolData, SymbolDataResponse
from .reader import MarketDataReader
from .writer import MarketDataWriter

__all__ = [
    "HistoricalBar",
    "MarketDataConfig",
    "MarketDataReader",
    "MarketDataWriter",
    "RateLimitConfig",
    "SymbolData",
    "SymbolDataResponse",
    "init_market_data_service",
    "shutdown_market_data_service",
]
