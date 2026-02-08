"""Market data reader -- serves historical prices from RAM."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta

from loguru import logger
from pymongo.asynchronous.database import AsyncDatabase

from ..config import MarketDataConfig
from ..event_bus.protocol import Event, EventBus, EventType
from ..models import SymbolDataResponse
from ..mongo.queries import read_all_historical, read_symbols_historical, read_tracked_symbols
from .store import InMemoryPriceStore


class MarketDataReader:
    """Serves historical closing price data from RAM.

    All queries are answered from an in-memory store that is loaded from MongoDB
    on startup and kept up-to-date via event bus notifications from the writer.
    """

    def __init__(
        self,
        config: MarketDataConfig,
        event_bus: EventBus,
        db: AsyncDatabase,
    ) -> None:
        self._config = config
        self._event_bus = event_bus
        self._db = db
        self._store = InMemoryPriceStore()
        self._cleanup_task: asyncio.Task[None] | None = None
        self._collection_name = config.timeseries_collection
        self._tracked_symbols: dict[str, str] = {}  # {symbol: market}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_prices(
        self,
        symbols: list[str],
        since_date: date | None = None,
    ) -> SymbolDataResponse:
        """Get historical bars for *symbols*.

        Missing symbols are returned with ``status='no_data'``.
        """
        data = self._store.get(symbols, since_date=since_date)
        return SymbolDataResponse(data=data)

    async def get_last_dates(self, symbols: list[str] | None = None) -> dict[str, date]:
        """Most recent bar date per symbol.  ``None`` = all known symbols."""
        return self._store.get_last_dates(symbols)

    async def get_tracked_symbols(self) -> dict[str, str]:
        """Return tracked symbols as ``{symbol: market}``."""
        return dict(self._tracked_symbols)

    async def get_historical_prices(
        self,
        symbols: list[str],
        days: int = 365,
    ) -> dict[str, list[dict]]:
        """Compat method matching old ``PriceManager.get_historical_prices()`` format.

        Returns ``{"AAPL": [{"date": "2025-11-14", "price": 150.50}, ...], ...}``
        """
        since = date.today() - timedelta(days=days)
        resp = await self.get_prices(symbols, since_date=since)
        result: dict[str, list[dict]] = {}
        for symbol, sym_data in resp.data.items():
            if sym_data.status == "ok" and sym_data.bars:
                result[symbol] = [
                    {
                        "date": bar.timestamp.strftime("%Y-%m-%d"),
                        "price": bar.close,
                    }
                    for bar in sym_data.bars
                ]
            else:
                result[symbol] = []
        return result

    async def refresh(self, symbols: list[str] | None = None) -> None:
        """Force re-read from MongoDB."""
        await self._load_from_mongo(symbols)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Load from MongoDB, subscribe to events, start cleanup task."""
        try:
            await self._load_from_mongo()
        except Exception:
            logger.opt(exception=True).warning(
                "Failed to load from MongoDB on startup -- starting with empty store"
            )

        try:
            await self._load_tracked_symbols()
        except Exception:
            logger.opt(exception=True).warning(
                "Failed to load tracked symbols on startup"
            )

        await self._event_bus.subscribe(EventType.DATA_WRITTEN, self._on_data_written)
        await self._event_bus.subscribe(EventType.REFRESH_REQUEST, self._on_data_written)
        self._cleanup_task = asyncio.create_task(self._daily_cleanup_loop())

    async def stop(self) -> None:
        """Cancel cleanup task and clear store."""
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
        await self._store.clear()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _on_data_written(self, event: Event) -> None:
        """Re-read symbols from MongoDB on event bus notification."""
        try:
            await self._load_from_mongo(event.symbols)
        except Exception:
            logger.opt(exception=True).warning("Failed to refresh from MongoDB after event")

    async def _load_from_mongo(self, symbols: list[str] | None = None) -> None:
        since = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=self._config.retention_days)
        if symbols is None:
            data = await read_all_historical(self._db, self._collection_name, since)
            await self._store.load_many(data)
            logger.info(f"Loaded {len(data)} symbols from MongoDB into RAM")
        else:
            data = await read_symbols_historical(self._db, self._collection_name, symbols, since)
            for sym, bars in data.items():
                await self._store.load(sym, bars)
            logger.info(f"Refreshed {len(symbols)} symbols from MongoDB")

    async def _load_tracked_symbols(self) -> None:
        """Load tracked symbols from MongoDB ``tracked_symbols`` collection."""
        docs = await read_tracked_symbols(self._db)
        self._tracked_symbols = {d["symbol"]: d["market"] for d in docs}
        logger.info(f"Loaded {len(self._tracked_symbols)} tracked symbols")

    async def _daily_cleanup_loop(self) -> None:
        """Remove bars older than retention_days once per day."""
        try:
            while True:
                now = datetime.now(UTC).replace(tzinfo=None)
                target = now.replace(
                    hour=self._config.ram_cleanup_hour,
                    minute=0,
                    second=0,
                    microsecond=0,
                )
                if target <= now:
                    target += timedelta(days=1)
                sleep_seconds = (target - now).total_seconds()
                await asyncio.sleep(sleep_seconds)

                cutoff = datetime.now(UTC).replace(tzinfo=None).date() - timedelta(days=self._config.retention_days)
                await self._store.discard_before(cutoff)
                logger.info(f"RAM cleanup: discarded bars before {cutoff}")
        except asyncio.CancelledError:
            pass
