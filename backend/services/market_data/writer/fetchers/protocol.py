"""Abstract interface for price data fetchers."""

from __future__ import annotations

from datetime import date
from typing import Protocol, runtime_checkable

from ...models import HistoricalBar


@runtime_checkable
class PriceFetcher(Protocol):
    """Interface for fetching historical closing prices from an external source."""

    async def fetch_historical(
        self,
        symbol: str,
        start: date,
        end: date,
    ) -> list[HistoricalBar] | None:
        """Fetch historical bars for *symbol*.  Returns ``None`` if not found."""
        ...

    @property
    def market(self) -> str:
        """Market this fetcher serves (US, TASE, CURRENCY, CRYPTO)."""
        ...

    @property
    def rate_limiter_key(self) -> str:
        """Key into ``config.rate_limits`` for this fetcher's rate limiter."""
        ...
