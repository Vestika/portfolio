"""Market data writer -- orchestration, backfill logic, scheduling."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta

from loguru import logger
from pymongo.asynchronous.database import AsyncDatabase

from ..config import MarketDataConfig
from ..event_bus.protocol import Event, EventBus, EventType
from ..mongo.queries import read_tracked_symbols, update_tracked_symbol_last_update, write_historical
from ..reader.reader import MarketDataReader
from .backfill_policy import BackfillPolicy
from .fetchers.registry import FetcherRegistry
from .work_queue import FetchTask, PriorityWorkQueue, TaskPriority


class RateLimitError(Exception):
    """Raised when a fetcher is rate-limited by the upstream API."""


class MarketDataWriter:
    """Manages all writes of market data to MongoDB.

    Fetches closing prices from external APIs, writes to MongoDB time-series
    collection, and notifies the reader to refresh its RAM cache.
    """

    def __init__(
        self,
        config: MarketDataConfig,
        event_bus: EventBus,
        reader: MarketDataReader,
        db: AsyncDatabase,
        fetcher_registry: FetcherRegistry,
    ) -> None:
        self._config = config
        self._event_bus = event_bus
        self._reader = reader
        self._db = db
        self._fetcher_registry = fetcher_registry
        self._queue = PriorityWorkQueue()
        self._backfill_policy = BackfillPolicy(staleness_days=config.backfill_staleness_days)
        self._collection = config.timeseries_collection

        self._symbol_states: dict[str, date | None] = {}
        self._symbol_markets: dict[str, str] = {}  # symbol → market from tracked_symbols
        self._worker_tasks: list[asyncio.Task[None]] = []
        self._scheduler_task: asyncio.Task[None] | None = None
        self._running = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def add_symbols(self, symbols: list[str], markets: list[str]) -> None:
        """App reports new symbols.  Enqueued with HIGH priority."""
        today = date.today()
        for symbol, market in zip(symbols, markets):
            self._symbol_markets[symbol] = market
            last = self._symbol_states.get(symbol)
            start = self._backfill_policy.compute_backfill_start(last, self._config.retention_days)
            task = FetchTask(
                symbol=symbol,
                market=market,
                priority=TaskPriority.HIGH,
                start_date=start,
                end_date=today,
            )
            await self._queue.enqueue(task)
            logger.info(f"Enqueued new symbol {symbol} (HIGH priority)")

    async def force_backfill(self, symbols: list[str] | None = None) -> None:
        """Admin: force re-fetch with CRITICAL priority."""
        if symbols is None:
            symbols = list(self._symbol_states.keys())
        today = date.today()
        for symbol in symbols:
            last = self._symbol_states.get(symbol)
            start = self._backfill_policy.compute_backfill_start(last, self._config.retention_days)
            task = FetchTask(
                symbol=symbol,
                market=self._guess_market(symbol),
                priority=TaskPriority.CRITICAL,
                start_date=start,
                end_date=today,
            )
            await self._queue.enqueue(task)

    async def force_fetch_all(self) -> None:
        """Admin: re-fetch everything from scratch."""
        today = date.today()
        start = today - timedelta(days=self._config.retention_days)
        for symbol in list(self._symbol_states.keys()):
            task = FetchTask(
                symbol=symbol,
                market=self._guess_market(symbol),
                priority=TaskPriority.CRITICAL,
                start_date=start,
                end_date=today,
            )
            await self._queue.enqueue(task)

    async def fill_gaps(self, symbol: str, start: date, end: date) -> None:
        """Admin: fill specific date range gaps."""
        task = FetchTask(
            symbol=symbol,
            market=self._guess_market(symbol),
            priority=TaskPriority.LOW,
            start_date=start,
            end_date=end,
        )
        await self._queue.enqueue(task)

    async def get_queue_status(self) -> dict:
        """Return queue size, pending symbols, running state."""
        return {
            "queue_size": self._queue.size,
            "pending_symbols": sorted(self._queue.pending_symbols),
            "running": self._running,
            "workers": len(self._worker_tasks),
        }

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Load state from reader + tracked_symbols, start workers + daily scheduler."""
        self._running = True

        # Bootstrap from reader (bars already in RAM)
        last_dates = await self._reader.get_last_dates()
        self._symbol_states = {s: d for s, d in last_dates.items()}

        # Load tracked symbols (includes symbols that may not have bars yet)
        tracked = await self._reader.get_tracked_symbols()
        self._symbol_markets = dict(tracked)

        # Merge tracked symbols into symbol_states (those not in reader get None)
        for symbol in tracked:
            if symbol not in self._symbol_states:
                self._symbol_states[symbol] = None

        logger.info(
            f"Writer bootstrap: {len(self._symbol_states)} symbols "
            f"({len(last_dates)} with bars, {len(tracked)} tracked)"
        )

        # Use last_update from tracked_symbols for smarter backfill decisions
        tracked_docs = await read_tracked_symbols(self._db)
        last_updates: dict[str, datetime | None] = {
            d["symbol"]: d.get("last_update") for d in tracked_docs
        }

        # Startup backfill
        today = date.today()
        enqueued = 0
        for symbol, last_bar_date in self._symbol_states.items():
            # Use last_update from tracked_symbols if available and more recent
            last_update = last_updates.get(symbol)
            effective_last = last_bar_date
            if last_update is not None:
                last_update_date = last_update.date() if isinstance(last_update, datetime) else last_update
                if effective_last is None or last_update_date > effective_last:
                    effective_last = last_update_date

            if self._backfill_policy.needs_startup_backfill(effective_last):
                start = self._backfill_policy.compute_backfill_start(last_bar_date, self._config.retention_days)
                priority = TaskPriority.HIGH if last_bar_date is None else TaskPriority.NORMAL
                task = FetchTask(
                    symbol=symbol,
                    market=self._guess_market(symbol),
                    priority=priority,
                    start_date=start,
                    end_date=today,
                )
                await self._queue.enqueue(task)
                enqueued += 1

        logger.info(f"Startup backfill: enqueued {enqueued}/{len(self._symbol_states)} symbols")

        # Subscribe to SYMBOL_ADDED
        await self._event_bus.subscribe(EventType.SYMBOL_ADDED, self._on_symbol_added)

        # Start workers
        for i in range(self._config.max_concurrent_fetches):
            t = asyncio.create_task(self._worker_loop(), name=f"writer-worker-{i}")
            self._worker_tasks.append(t)

        # Start daily scheduler
        self._scheduler_task = asyncio.create_task(self._daily_backfill_loop())

    async def stop(self) -> None:
        """Graceful shutdown: stop workers, drain queue."""
        self._running = False

        if self._scheduler_task is not None:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
            self._scheduler_task = None

        for task in self._worker_tasks:
            task.cancel()
        if self._worker_tasks:
            await asyncio.gather(*self._worker_tasks, return_exceptions=True)
        self._worker_tasks.clear()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _on_symbol_added(self, event: Event) -> None:
        """Handle new symbols from the event bus."""
        if event.symbols:
            markets = event.metadata.get("markets", ["US"] * len(event.symbols))
            await self.add_symbols(event.symbols, markets)

    async def _worker_loop(self) -> None:
        """Dequeue tasks, fetch data, write to mongo, notify reader."""
        try:
            while self._running:
                task = await self._queue.dequeue()

                try:
                    fetcher, rate_limiter = self._fetcher_registry.get(task.market)
                except KeyError:
                    logger.warning(f"No fetcher for market '{task.market}', dropping {task.symbol}")
                    continue

                await rate_limiter.acquire()

                try:
                    bars = await fetcher.fetch_historical(task.symbol, task.start_date, task.end_date)

                    if bars:
                        inserted = await write_historical(
                            self._db, self._collection, task.symbol, bars
                        )
                        rate_limiter.report_success()

                        if inserted > 0:
                            await self._event_bus.publish(
                                Event(type=EventType.DATA_WRITTEN, symbols=[task.symbol])
                            )

                        # Update local state
                        newest = max(b.timestamp.date() for b in bars)
                        self._symbol_states[task.symbol] = newest

                        # Update last_update in tracked_symbols
                        try:
                            now = datetime.now(UTC).replace(tzinfo=None)
                            await update_tracked_symbol_last_update(
                                self._db, task.symbol, now
                            )
                        except Exception:
                            logger.opt(exception=True).debug(
                                f"Failed to update last_update for {task.symbol}"
                            )
                    else:
                        rate_limiter.report_success()

                except RateLimitError:
                    rate_limiter.report_rejection()
                    if task.retries < self._config.max_retries:
                        await self._queue.requeue_with_delay(task, self._config.retry_delay_seconds)
                    else:
                        logger.error(f"Rate limit: {task.symbol} exhausted retries")

                except Exception:
                    logger.opt(exception=True).error(f"Fetch failed for {task.symbol}")
                    if task.retries < self._config.max_retries:
                        await self._queue.requeue_with_delay(task, self._config.retry_delay_seconds)
                    else:
                        logger.error(f"{task.symbol} failed after {task.retries} retries")

        except asyncio.CancelledError:
            pass

    async def _daily_backfill_loop(self) -> None:
        """Unconditionally enqueue all symbols every backfill_interval_hours."""
        try:
            while self._running:
                await asyncio.sleep(self._config.backfill_interval_hours * 3600)
                await self._run_daily_backfill()
        except asyncio.CancelledError:
            pass

    async def _run_daily_backfill(self) -> None:
        """Enqueue ALL symbols unconditionally with NORMAL priority."""
        today = date.today()
        # Refresh state from reader in case new symbols were added
        last_dates = await self._reader.get_last_dates()
        self._symbol_states.update(last_dates)

        count = 0
        for symbol, last in self._symbol_states.items():
            start = self._backfill_policy.compute_backfill_start(last, self._config.retention_days)
            if start > today:
                continue
            task = FetchTask(
                symbol=symbol,
                market=self._guess_market(symbol),
                priority=TaskPriority.NORMAL,
                start_date=start,
                end_date=today,
            )
            await self._queue.enqueue(task)
            count += 1
        logger.info(f"Daily backfill: enqueued {count} symbols")

    def _guess_market(self, symbol: str) -> str:
        """Best-effort market detection: check tracked map first, then heuristic."""
        if symbol in self._symbol_markets:
            return self._symbol_markets[symbol]
        if symbol.isdigit():
            return "TASE"
        if symbol.startswith("FX:"):
            return "CURRENCY"
        return "US"
