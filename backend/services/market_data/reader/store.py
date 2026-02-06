"""In-memory price store for historical bars."""

from __future__ import annotations

import asyncio
from datetime import date, datetime

from ..models import HistoricalBar, SymbolData


class InMemoryPriceStore:
    """Thread-safe and asyncio-safe in-memory store for historical bars.

    Bars are stored as sorted lists (by timestamp) per symbol.
    A separate ``_last_dates`` index avoids scanning bars for every query.
    ``asyncio.Lock`` protects writes; reads are safe without a lock because
    we do atomic dict-reference swaps for bulk operations.
    """

    def __init__(self) -> None:
        self._data: dict[str, list[HistoricalBar]] = {}
        self._last_dates: dict[str, date] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Write operations (require lock)
    # ------------------------------------------------------------------

    async def load(self, symbol: str, bars: list[HistoricalBar]) -> None:
        """Replace all data for *symbol*."""
        sorted_bars = sorted(bars, key=lambda b: b.timestamp)
        async with self._lock:
            if sorted_bars:
                self._data[symbol] = sorted_bars
                self._last_dates[symbol] = sorted_bars[-1].timestamp.date()
            else:
                self._data.pop(symbol, None)
                self._last_dates.pop(symbol, None)

    async def load_many(self, data: dict[str, list[HistoricalBar]]) -> None:
        """Bulk load.  Replaces data for every symbol in *data*."""
        prepared: dict[str, list[HistoricalBar]] = {}
        last_dates: dict[str, date] = {}
        for symbol, bars in data.items():
            sorted_bars = sorted(bars, key=lambda b: b.timestamp)
            if sorted_bars:
                prepared[symbol] = sorted_bars
                last_dates[symbol] = sorted_bars[-1].timestamp.date()

        async with self._lock:
            self._data.update(prepared)
            self._last_dates.update(last_dates)

    async def discard_before(self, cutoff_date: date) -> None:
        """Remove bars older than *cutoff_date* and drop empty symbols."""
        cutoff_dt = datetime.combine(cutoff_date, datetime.min.time())
        async with self._lock:
            to_remove: list[str] = []
            for symbol, bars in self._data.items():
                filtered = [b for b in bars if b.timestamp >= cutoff_dt]
                if filtered:
                    self._data[symbol] = filtered
                    self._last_dates[symbol] = filtered[-1].timestamp.date()
                else:
                    to_remove.append(symbol)
            for symbol in to_remove:
                del self._data[symbol]
                self._last_dates.pop(symbol, None)

    async def clear(self) -> None:
        """Drop everything."""
        async with self._lock:
            self._data.clear()
            self._last_dates.clear()

    # ------------------------------------------------------------------
    # Read operations (lock-free)
    # ------------------------------------------------------------------

    def get(
        self,
        symbols: list[str],
        since_date: date | None = None,
    ) -> dict[str, SymbolData]:
        """Return data for *symbols*.

        Missing symbols are returned with ``status="no_data"``.
        """
        result: dict[str, SymbolData] = {}
        for symbol in symbols:
            bars = self._data.get(symbol)
            if bars is None:
                result[symbol] = SymbolData(symbol=symbol, bars=[], status="no_data")
                continue

            if since_date is not None:
                cutoff = datetime.combine(since_date, datetime.min.time())
                filtered = [b for b in bars if b.timestamp >= cutoff]
            else:
                filtered = list(bars)

            last = self._last_dates.get(symbol)
            result[symbol] = SymbolData(
                symbol=symbol,
                bars=filtered,
                last_date=last,
                status="ok",
            )
        return result

    def get_last_dates(self, symbols: list[str] | None = None) -> dict[str, date]:
        """Return the most recent bar date for each symbol.

        ``symbols=None`` means all known symbols.
        """
        if symbols is None:
            return dict(self._last_dates)
        return {s: self._last_dates[s] for s in symbols if s in self._last_dates}

    def symbols(self) -> set[str]:
        """All symbols currently in the store."""
        return set(self._data.keys())
