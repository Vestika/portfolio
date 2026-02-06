"""Market data Pydantic models."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class HistoricalBar(BaseModel):
    """Single closing price for a symbol on a specific date.

    We only store the date and closing price. Other OHLCV fields are intentionally
    omitted -- this service focuses on closing prices for portfolio valuation.
    """

    timestamp: datetime  # Date at 20:00 UTC (market close convention)
    close: float


class SymbolData(BaseModel):
    """All historical data for a single symbol, as served to callers.

    ``status`` tells the consumer what to do:

    - ``ok``: data is available in ``bars``
    - ``no_data``: no data exists for this symbol yet
    - ``pending``: writer is actively fetching, consumer should retry later
    """

    symbol: str
    bars: list[HistoricalBar]
    last_date: date | None = None
    status: Literal["ok", "no_data", "pending"]


class SymbolDataResponse(BaseModel):
    """Response for a batch query.  Keys = symbols, values = their data."""

    data: dict[str, SymbolData]
