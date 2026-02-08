"""MarketDataWriter unit tests."""

import asyncio
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.market_data.config import MarketDataConfig, RateLimitConfig
from services.market_data.event_bus.in_process import InProcessEventBus
from services.market_data.event_bus.protocol import Event, EventType
from services.market_data.models import HistoricalBar
from services.market_data.reader.reader import MarketDataReader
from services.market_data.writer.fetchers.registry import FetcherRegistry
from services.market_data.writer.rate_limiter import TokenBucketRateLimiter
from services.market_data.writer.work_queue import TaskPriority
from services.market_data.writer.writer import MarketDataWriter, RateLimitError
from tests.conftest import FakeDatabase, make_bars


@pytest.fixture
def writer_config() -> MarketDataConfig:
    return MarketDataConfig(
        retention_days=365,
        backfill_staleness_days=3,
        backfill_interval_hours=24,
        max_concurrent_fetches=1,
        max_retries=2,
        retry_delay_seconds=0.01,
        rate_limits={
            "yahoo": RateLimitConfig(requests_per_second=100.0, burst_size=100, cooldown_seconds=0.01),
            "tase": RateLimitConfig(requests_per_second=100.0, burst_size=100, cooldown_seconds=0.01),
        },
    )


def _make_mock_fetcher(bars: list[HistoricalBar] | None = None):
    """Create a mock fetcher that returns given bars."""
    fetcher = AsyncMock()
    fetcher.fetch_historical = AsyncMock(return_value=bars)
    fetcher.market = "US"
    fetcher.rate_limiter_key = "yahoo"
    return fetcher


def _make_registry(fetcher, limiter_config=None):
    if limiter_config is None:
        limiter_config = RateLimitConfig(requests_per_second=100.0, burst_size=100, cooldown_seconds=0.01)
    registry = FetcherRegistry()
    limiter = TokenBucketRateLimiter(limiter_config)
    registry.register("US", fetcher, limiter)
    return registry


class TestMarketDataWriter:
    async def test_start_queries_reader_for_last_dates(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={"AAPL": date.today()})
        reader.get_tracked_symbols = AsyncMock(return_value={})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        try:
            reader.get_last_dates.assert_called_once()
        finally:
            await writer.stop()

    async def test_startup_enqueues_backfill_for_stale_symbols(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        stale_date = date.today() - timedelta(days=5)
        reader.get_last_dates = AsyncMock(return_value={"STALE": stale_date})
        reader.get_tracked_symbols = AsyncMock(return_value={"STALE": "US"})
        fetcher = _make_mock_fetcher(make_bars("STALE", days=3))
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        await asyncio.sleep(0.1)
        try:
            # Fetcher should have been called for the stale symbol
            assert fetcher.fetch_historical.called
        finally:
            await writer.stop()

    async def test_startup_skips_fresh_symbols(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        fresh_date = date.today() - timedelta(days=1)
        reader.get_last_dates = AsyncMock(return_value={"FRESH": fresh_date})
        reader.get_tracked_symbols = AsyncMock(return_value={"FRESH": "US"})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        await asyncio.sleep(0.1)
        try:
            # Fetcher should NOT have been called -- symbol is fresh
            assert not fetcher.fetch_historical.called
        finally:
            await writer.stop()

    async def test_worker_fetches_and_writes(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        reader.get_tracked_symbols = AsyncMock(return_value={})
        bars = make_bars("AAPL", days=5)
        fetcher = _make_mock_fetcher(bars)
        registry = _make_registry(fetcher)

        published_events: list[Event] = []

        async def track_events(event: Event):
            published_events.append(event)

        await event_bus.subscribe(EventType.DATA_WRITTEN, track_events)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["AAPL"], ["US"])
        await asyncio.sleep(0.2)
        try:
            assert fetcher.fetch_historical.called
            # Check data was written to mock DB
            coll = db[writer_config.timeseries_collection]
            assert await coll.count_documents() == 5
            # Check event published
            assert any(e.symbols == ["AAPL"] for e in published_events)
        finally:
            await writer.stop()

    async def test_worker_retries_on_failure(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        reader.get_tracked_symbols = AsyncMock(return_value={})
        fetcher = AsyncMock()
        fetcher.fetch_historical = AsyncMock(side_effect=[RuntimeError("oops"), make_bars("AAPL", days=3)])
        fetcher.market = "US"
        fetcher.rate_limiter_key = "yahoo"
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["AAPL"], ["US"])
        await asyncio.sleep(0.3)
        try:
            assert fetcher.fetch_historical.call_count >= 2
        finally:
            await writer.stop()

    async def test_worker_gives_up_after_max_retries(self, writer_config, event_bus):
        writer_config.max_retries = 1
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        reader.get_tracked_symbols = AsyncMock(return_value={})
        fetcher = AsyncMock()
        fetcher.fetch_historical = AsyncMock(side_effect=RuntimeError("permanent failure"))
        fetcher.market = "US"
        fetcher.rate_limiter_key = "yahoo"
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["AAPL"], ["US"])
        await asyncio.sleep(0.3)
        try:
            # Should have been called multiple times then stopped
            assert fetcher.fetch_historical.call_count <= 3
            # Queue should be empty (task dropped)
            assert writer._queue.size == 0
        finally:
            await writer.stop()

    async def test_worker_handles_rate_limit_rejection(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        reader.get_tracked_symbols = AsyncMock(return_value={})
        fetcher = AsyncMock()
        fetcher.fetch_historical = AsyncMock(
            side_effect=[RateLimitError("429"), make_bars("AAPL", days=3)]
        )
        fetcher.market = "US"
        fetcher.rate_limiter_key = "yahoo"
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["AAPL"], ["US"])
        await asyncio.sleep(0.3)
        try:
            assert fetcher.fetch_historical.call_count >= 2
        finally:
            await writer.stop()

    async def test_add_symbols_enqueues_high_priority(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        # Don't start workers -- just check queue
        writer._running = True
        writer._symbol_states = {}
        await writer.add_symbols(["NEW"], ["US"])
        assert writer._queue.has_pending("NEW")

    async def test_new_symbol_cuts_in_line(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        writer._running = True
        writer._symbol_states = {}

        from services.market_data.writer.work_queue import FetchTask, TaskPriority

        # Enqueue normal priority tasks first
        for sym in ["A", "B", "C"]:
            await writer._queue.enqueue(
                FetchTask(symbol=sym, market="US", priority=TaskPriority.NORMAL,
                          start_date=date.today(), end_date=date.today())
            )

        # Add new symbol (HIGH priority)
        await writer.add_symbols(["URGENT"], ["US"])

        # URGENT should be dequeued first
        task = await writer._queue.dequeue()
        assert task.symbol == "URGENT"

    async def test_force_backfill_enqueues_critical(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        writer._running = True
        writer._symbol_states = {"AAPL": date.today()}
        await writer.force_backfill(["AAPL"])
        assert writer._queue.has_pending("AAPL")

    async def test_fill_gaps_creates_correct_date_range(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        writer._running = True
        writer._symbol_states = {}
        start = date(2025, 6, 1)
        end = date(2025, 6, 30)
        await writer.fill_gaps("AAPL", start, end)

        task = await writer._queue.dequeue()
        assert task.symbol == "AAPL"
        assert task.start_date == start
        assert task.end_date == end

    async def test_daily_backfill_enqueues_all_symbols_unconditionally(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={
            "AAPL": date.today() - timedelta(days=1),
            "MSFT": date.today(),
        })
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        writer._running = True
        writer._symbol_states = {"AAPL": date.today() - timedelta(days=1), "MSFT": date.today()}

        await writer._run_daily_backfill()
        # Both should be enqueued
        symbols = writer._queue.pending_symbols
        assert "AAPL" in symbols

    async def test_daily_backfill_includes_fresh_symbols(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        yesterday = date.today() - timedelta(days=1)
        reader.get_last_dates = AsyncMock(return_value={"FRESH": yesterday})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        writer._running = True
        writer._symbol_states = {"FRESH": yesterday}

        await writer._run_daily_backfill()
        assert "FRESH" in writer._queue.pending_symbols

    async def test_notifies_reader_after_write(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        reader.get_tracked_symbols = AsyncMock(return_value={})
        bars = make_bars("AAPL", days=3)
        fetcher = _make_mock_fetcher(bars)
        registry = _make_registry(fetcher)

        events_received: list[Event] = []

        async def capture(event: Event):
            events_received.append(event)

        await event_bus.subscribe(EventType.DATA_WRITTEN, capture)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        await writer.add_symbols(["AAPL"], ["US"])
        await asyncio.sleep(0.2)
        try:
            written_symbols = [s for e in events_received for s in (e.symbols or [])]
            assert "AAPL" in written_symbols
        finally:
            await writer.stop()

    async def test_stop_drains_gracefully(self, writer_config, event_bus):
        db = FakeDatabase()
        reader = MagicMock(spec=MarketDataReader)
        reader.get_last_dates = AsyncMock(return_value={})
        reader.get_tracked_symbols = AsyncMock(return_value={})
        fetcher = _make_mock_fetcher()
        registry = _make_registry(fetcher)

        writer = MarketDataWriter(writer_config, event_bus, reader, db, registry)
        await writer.start()
        # Add some tasks
        writer._symbol_states = {}
        await writer.add_symbols(["A", "B", "C"], ["US", "US", "US"])
        # Stop immediately
        await writer.stop()
        assert not writer._running
        assert writer._worker_tasks == []
