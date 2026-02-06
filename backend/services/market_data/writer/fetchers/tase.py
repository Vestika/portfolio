"""TASE fetcher (pymaya wrapper)."""

from __future__ import annotations

import asyncio
from datetime import date, datetime

from loguru import logger

from ...models import HistoricalBar


class TASEFetcher:
    """Fetches historical closing prices for TASE securities via pymaya.

    - Runs in executor to avoid blocking
    - Agorot-to-ILS conversion (divide by 100)
    - Handles both ``DD/MM/YYYY`` and ISO date formats
    """

    @property
    def market(self) -> str:
        return "TASE"

    @property
    def rate_limiter_key(self) -> str:
        return "tase"

    async def fetch_historical(
        self,
        symbol: str,
        start: date,
        end: date,
    ) -> list[HistoricalBar] | None:
        logger.debug(f"TASE: fetching {symbol} ({start} to {end})")

        loop = asyncio.get_running_loop()
        try:
            raw = await asyncio.wait_for(
                loop.run_in_executor(None, self._fetch_sync, symbol, start),
                timeout=10.0,
            )
        except asyncio.TimeoutError:
            logger.warning(f"TASE: timeout fetching {symbol}")
            return None
        except Exception:
            logger.opt(exception=True).error(f"TASE: error fetching {symbol}")
            return None

        if not raw:
            logger.debug(f"TASE: no data for {symbol}")
            return None

        return self._parse_entries(raw, end)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _fetch_sync(symbol: str, start: date) -> list[dict]:
        from pymaya.maya import Maya

        maya = Maya()
        return list(maya.get_price_history(security_id=str(symbol), from_date=start))

    @staticmethod
    def _parse_entries(entries: list[dict], end: date) -> list[HistoricalBar] | None:
        bars: list[HistoricalBar] = []
        for entry in reversed(entries):  # pymaya returns newest first
            trade_date_str = entry.get("TradeDate")
            if not trade_date_str:
                continue
            price_raw = entry.get("CloseRate") or entry.get("SellPrice")
            if not price_raw:
                continue

            try:
                trade_date = TASEFetcher._parse_date(str(trade_date_str))
            except ValueError:
                continue

            if trade_date > end:
                continue

            # TASE prices from pymaya are in agorot (1/100 shekel)
            price = float(price_raw) / 100.0
            timestamp = datetime.combine(trade_date, datetime.min.time()).replace(hour=20, minute=0)
            bars.append(HistoricalBar(timestamp=timestamp, close=round(price, 2)))

        return bars if bars else None

    @staticmethod
    def _parse_date(value: str) -> date:
        """Parse pymaya date -- handles ``DD/MM/YYYY`` and ISO datetime."""
        if "T" in value:
            return datetime.fromisoformat(value.replace("T00:00:00", "")).date()
        return datetime.strptime(value, "%d/%m/%Y").date()
