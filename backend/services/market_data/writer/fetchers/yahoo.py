"""Yahoo Finance fetcher (yfinance wrapper)."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

from loguru import logger

from ...models import HistoricalBar


# Global lock to serialize yfinance calls -- prevents data mixing
# between symbols (known issue yfinance #2557).
_yfinance_lock = asyncio.Lock()


class YahooFinanceFetcher:
    """Fetches historical closing prices via yfinance.

    - Global asyncio lock (prevents yfinance data mixing)
    - Runs in executor to avoid blocking the event loop
    - 30s timeout
    - Currency symbol mapping (``FX:USD`` -> ``USDILS=X``)
    - Exchange prefix stripping (``NYSE:BTC`` -> ``BTC``)
    """

    @property
    def market(self) -> str:
        return "US"

    @property
    def rate_limiter_key(self) -> str:
        return "yahoo"

    async def fetch_historical(
        self,
        symbol: str,
        start: date,
        end: date,
    ) -> list[HistoricalBar] | None:
        yf_symbol = self._map_symbol(symbol)

        # Special case: ILS base currency is always 1.0
        if symbol.startswith("FX:") and symbol[3:] == "ILS":
            return self._generate_flat_currency(start, end)

        logger.debug(f"Yahoo: fetching {yf_symbol} ({start} to {end})")

        async with _yfinance_lock:
            loop = asyncio.get_running_loop()
            try:
                df = await asyncio.wait_for(
                    loop.run_in_executor(None, self._download_sync, yf_symbol, start, end),
                    timeout=30.0,
                )
            except asyncio.TimeoutError:
                logger.warning(f"Yahoo: timeout fetching {yf_symbol}")
                return None

        if df is None or df.empty:
            logger.debug(f"Yahoo: no data for {yf_symbol}")
            return None

        return self._parse_dataframe(df)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _map_symbol(symbol: str) -> str:
        """Map internal symbol format to yfinance ticker."""
        if symbol.startswith("FX:"):
            currency = symbol[3:]
            return f"{currency}ILS=X"
        for prefix in ("NYSE:", "NASDAQ:"):
            if symbol.startswith(prefix):
                return symbol[len(prefix):]
        return symbol

    @staticmethod
    def _download_sync(yf_symbol: str, start: date, end: date):  # noqa: ANN205
        import yfinance as yf

        end_inclusive = end + timedelta(days=1)
        return yf.download(
            yf_symbol,
            start=start,
            end=end_inclusive,
            progress=False,
            auto_adjust=True,
            threads=False,
        )

    @staticmethod
    def _parse_dataframe(df) -> list[HistoricalBar]:  # noqa: ANN001
        bars: list[HistoricalBar] = []
        if "Close" not in df.columns:
            return bars
        prices = df["Close"].dropna()
        for dt in prices.index:
            price_date = dt.date() if hasattr(dt, "date") else dt
            timestamp = datetime.combine(price_date, datetime.min.time()).replace(hour=20, minute=0)
            value = prices.loc[dt]
            if hasattr(value, "iloc"):
                value = float(value.iloc[0])
            else:
                value = float(value)
            bars.append(HistoricalBar(timestamp=timestamp, close=round(value, 2)))
        return bars

    @staticmethod
    def _generate_flat_currency(start: date, end: date) -> list[HistoricalBar]:
        bars: list[HistoricalBar] = []
        current = start
        while current <= end:
            ts = datetime.combine(current, datetime.min.time()).replace(hour=20, minute=0)
            bars.append(HistoricalBar(timestamp=ts, close=1.0))
            current += timedelta(days=1)
        return bars
