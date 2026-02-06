"""Reader + Writer integration tests (in-process event bus)."""

import asyncio
from datetime import date, timedelta
from unittest.mock import AsyncMock

import pytest

from services.market_data.config import MarketDataConfig, RateLimitConfig
from services.market_data.event_bus.in_process import InProcessEventBus
from services.market_data.event_bus.protocol import Event, EventType
from services.market_data.reader.reader import MarketDataReader
from services.market_data.writer.fetchers.registry import FetcherRegistry
from services.market_data.writer.rate_limiter import TokenBucketRateLimiter
from services.market_data.writer.writer import MarketDataWriter
from tests.conftest import FakeDatabase, make_bars


@pytest.fixture
def int_config() -> MarketDataConfig:
    return MarketDataConfig(
        retention_days=365,
        backfill_staleness_days=3,
        backfill_interval_hours=24,
        max_concurrent_fetches=2,
        max_retries=2,
        retry_delay_seconds=0.01,
        rate_limits={
            "yahoo": RateLimitConfig(requests_per_second=100.0, burst_size=100, cooldown_seconds=0.01),
            "tase": RateLimitConfig(requests_per_second=100.0, burst_size=100, cooldown_seconds=0.01),
        },
    )


def _mock_fetcher(symbol_bars: dict[str, list] | None = None):
    """Create a mock fetcher that returns bars by symbol."""
    fetcher = AsyncMock()
    if symbol_bars is None:
        symbol_bars = {}

    async def fetch(symbol, start, end):
        return symbol_bars.get(symbol)

    fetcher.fetch_historical = AsyncMock(side_effect=fetch)
    fetcher.market = "US"
    fetcher.rate_limiter_key = "yahoo"
    return fetcher


def _make_registry(fetcher, config):
    registry = FetcherRegistry()
    limiter = TokenBucketRateLimiter(config.rate_limits["yahoo"])
    registry.register("US", fetcher, limiter)
    return registry


class TestIntegration:
    async def test_writer_writes_reader_receives(self, int_config):
        bus = InProcessEventBus()
        await bus.start()
        db = FakeDatabase()

        reader = MarketDataReader(int_config, bus, db)
        await reader.start()

        bars = make_bars("AAPL", days=5)
        fetcher = _mock_fetcher({"AAPL": bars})
        registry = _make_registry(fetcher, int_config)

        writer = MarketDataWriter(int_config, bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["AAPL"], ["US"])
        await asyncio.sleep(0.3)

        try:
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "ok"
            assert len(resp.data["AAPL"].bars) == 5
        finally:
            await writer.stop()
            await reader.stop()
            await bus.stop()

    async def test_new_symbol_flow(self, int_config):
        bus = InProcessEventBus()
        await bus.start()
        db = FakeDatabase()

        reader = MarketDataReader(int_config, bus, db)
        await reader.start()

        bars = make_bars("TSLA", days=3)
        fetcher = _mock_fetcher({"TSLA": bars})
        registry = _make_registry(fetcher, int_config)

        writer = MarketDataWriter(int_config, bus, reader, db, registry)
        await writer.start()

        # Publish SYMBOL_ADDED event
        await bus.publish(Event(
            type=EventType.SYMBOL_ADDED,
            symbols=["TSLA"],
            metadata={"markets": ["US"]},
        ))
        await asyncio.sleep(0.3)

        try:
            resp = await reader.get_prices(["TSLA"])
            assert resp.data["TSLA"].status == "ok"
        finally:
            await writer.stop()
            await reader.stop()
            await bus.stop()

    async def test_priority_ordering_end_to_end(self, int_config):
        # Use 1 worker to ensure ordering is visible
        int_config.max_concurrent_fetches = 1
        bus = InProcessEventBus()
        await bus.start()
        db = FakeDatabase()

        reader = MarketDataReader(int_config, bus, db)
        await reader.start()

        fetch_order: list[str] = []

        async def tracking_fetch(symbol, start, end):
            fetch_order.append(symbol)
            return make_bars(symbol, days=2)

        fetcher = AsyncMock()
        fetcher.fetch_historical = AsyncMock(side_effect=tracking_fetch)
        fetcher.market = "US"
        fetcher.rate_limiter_key = "yahoo"
        registry = _make_registry(fetcher, int_config)

        writer = MarketDataWriter(int_config, bus, reader, db, registry)
        # Start without workers to control queue ordering
        writer._running = True
        writer._symbol_states = {}
        await bus.subscribe(EventType.SYMBOL_ADDED, writer._on_symbol_added)

        # Enqueue normal tasks first
        from services.market_data.writer.work_queue import FetchTask, TaskPriority

        for sym in ["SLOW_A", "SLOW_B"]:
            await writer._queue.enqueue(
                FetchTask(symbol=sym, market="US", priority=TaskPriority.NORMAL,
                          start_date=date.today(), end_date=date.today())
            )

        # Then high priority
        await writer.add_symbols(["URGENT"], ["US"])

        # Now start the worker
        worker = asyncio.create_task(writer._worker_loop())
        await asyncio.sleep(0.3)
        writer._running = False
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass

        try:
            assert fetch_order[0] == "URGENT"
        finally:
            await reader.stop()
            await bus.stop()

    async def test_daily_backfill_updates_reader(self, int_config):
        bus = InProcessEventBus()
        await bus.start()
        db = FakeDatabase()

        reader = MarketDataReader(int_config, bus, db)
        await reader.start()

        bars = make_bars("AAPL", days=3)
        fetcher = _mock_fetcher({"AAPL": bars})
        registry = _make_registry(fetcher, int_config)

        writer = MarketDataWriter(int_config, bus, reader, db, registry)
        await writer.start()

        # Manually set stale state and trigger daily backfill
        writer._symbol_states = {"AAPL": date.today() - timedelta(days=5)}
        await writer._run_daily_backfill()
        await asyncio.sleep(0.3)

        try:
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "ok"
        finally:
            await writer.stop()
            await reader.stop()
            await bus.stop()

    async def test_full_lifecycle(self, int_config):
        bus = InProcessEventBus()
        await bus.start()
        db = FakeDatabase()

        reader = MarketDataReader(int_config, bus, db)
        await reader.start()

        fetcher = _mock_fetcher({"AAPL": make_bars("AAPL", days=5)})
        registry = _make_registry(fetcher, int_config)

        writer = MarketDataWriter(int_config, bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["AAPL"], ["US"])
        await asyncio.sleep(0.3)

        resp = await reader.get_prices(["AAPL"])
        assert resp.data["AAPL"].status == "ok"

        # Clean shutdown
        await writer.stop()
        await reader.stop()
        await bus.stop()

    async def test_reader_serves_during_writer_backfill(self, int_config):
        bus = InProcessEventBus()
        await bus.start()
        db = FakeDatabase()

        # Pre-populate DB with some data
        from services.market_data.mongo.queries import write_historical
        existing_bars = make_bars("AAPL", days=3)
        await write_historical(db, int_config.timeseries_collection, "AAPL", existing_bars)

        reader = MarketDataReader(int_config, bus, db)
        await reader.start()

        # Reader should serve existing data immediately
        resp = await reader.get_prices(["AAPL"])
        assert resp.data["AAPL"].status == "ok"
        assert len(resp.data["AAPL"].bars) == 3

        # Start writer with slow fetcher
        async def slow_fetch(symbol, start, end):
            await asyncio.sleep(0.5)
            return make_bars(symbol, days=10)

        fetcher = AsyncMock()
        fetcher.fetch_historical = AsyncMock(side_effect=slow_fetch)
        fetcher.market = "US"
        fetcher.rate_limiter_key = "yahoo"
        registry = _make_registry(fetcher, int_config)

        writer = MarketDataWriter(int_config, bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["MSFT"], ["US"])

        # Reader still serves AAPL while writer is busy with MSFT
        resp = await reader.get_prices(["AAPL"])
        assert resp.data["AAPL"].status == "ok"

        await writer.stop()
        await reader.stop()
        await bus.stop()
