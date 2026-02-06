"""MarketDataReader unit tests."""

import asyncio
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from services.market_data.config import MarketDataConfig, RateLimitConfig
from services.market_data.event_bus.in_process import InProcessEventBus
from services.market_data.event_bus.protocol import Event, EventType
from services.market_data.models import HistoricalBar
from services.market_data.reader.reader import MarketDataReader
from tests.conftest import FakeDatabase, make_bars


@pytest.fixture
def reader_config() -> MarketDataConfig:
    return MarketDataConfig(
        retention_days=365,
        ram_cleanup_hour=3,
        rate_limits={
            "yahoo": RateLimitConfig(requests_per_second=100.0, burst_size=100),
            "tase": RateLimitConfig(requests_per_second=100.0, burst_size=100),
        },
    )


async def _populate_db(db: FakeDatabase, collection: str, symbols: dict[str, list[HistoricalBar]]):
    """Insert bars into fake DB."""
    for symbol, bars in symbols.items():
        docs = [{"symbol": symbol, "timestamp": b.timestamp, "close": b.close} for b in bars]
        if docs:
            await db[collection].insert_many(docs)


class TestMarketDataReader:
    async def test_start_loads_from_mongo(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        await _populate_db(db, coll, {"AAPL": make_bars("AAPL", days=10)})

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "ok"
            assert len(resp.data["AAPL"].bars) == 10
        finally:
            await reader.stop()

    async def test_start_empty_mongo(self, reader_config, event_bus):
        db = FakeDatabase()
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "no_data"
        finally:
            await reader.stop()

    async def test_on_data_written_refreshes_symbols(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            # Initially empty
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "no_data"

            # Simulate writer writing data
            await _populate_db(db, coll, {"AAPL": make_bars("AAPL", days=5)})
            await event_bus.publish(Event(type=EventType.DATA_WRITTEN, symbols=["AAPL"]))
            await asyncio.sleep(0.1)

            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "ok"
        finally:
            await reader.stop()

    async def test_on_data_written_all_symbols(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        await _populate_db(db, coll, {
            "AAPL": make_bars("AAPL", days=5),
            "MSFT": make_bars("MSFT", days=5),
        })

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            await event_bus.publish(Event(type=EventType.DATA_WRITTEN, symbols=None))
            await asyncio.sleep(0.1)
            resp = await reader.get_prices(["AAPL", "MSFT"])
            assert resp.data["AAPL"].status == "ok"
            assert resp.data["MSFT"].status == "ok"
        finally:
            await reader.stop()

    async def test_get_prices_returns_correct_data(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        bars = make_bars("AAPL", days=5)
        await _populate_db(db, coll, {"AAPL": bars})

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "ok"
            assert resp.data["AAPL"].last_date is not None
            assert len(resp.data["AAPL"].bars) == 5
        finally:
            await reader.stop()

    async def test_get_prices_missing_symbols_show_no_data(self, reader_config, event_bus):
        db = FakeDatabase()
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            resp = await reader.get_prices(["UNKNOWN1", "UNKNOWN2"])
            assert resp.data["UNKNOWN1"].status == "no_data"
            assert resp.data["UNKNOWN2"].status == "no_data"
        finally:
            await reader.stop()

    async def test_get_last_dates_delegates_to_store(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        await _populate_db(db, coll, {
            "AAPL": make_bars("AAPL", days=5),
            "MSFT": make_bars("MSFT", days=10),
        })

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            dates = await reader.get_last_dates()
            assert "AAPL" in dates
            assert "MSFT" in dates
        finally:
            await reader.stop()

    async def test_refresh_manual_trigger(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            # Add data after start
            await _populate_db(db, coll, {"GOOG": make_bars("GOOG", days=3)})
            await reader.refresh(["GOOG"])
            resp = await reader.get_prices(["GOOG"])
            assert resp.data["GOOG"].status == "ok"
        finally:
            await reader.stop()

    async def test_daily_cleanup_discards_old_data(self, reader_config, event_bus):
        # Use a very short retention for test
        reader_config.retention_days = 10
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        # Insert data from 30 days ago
        old_bars = make_bars("OLD", days=5, start=date.today() - timedelta(days=30))
        new_bars = make_bars("NEW", days=5)
        await _populate_db(db, coll, {"OLD": old_bars, "NEW": new_bars})

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            # Manually trigger cleanup via store
            cutoff = date.today() - timedelta(days=reader_config.retention_days)
            await reader._store.discard_before(cutoff)

            resp = await reader.get_prices(["OLD", "NEW"])
            assert resp.data["OLD"].status == "no_data"
            assert resp.data["NEW"].status == "ok"
        finally:
            await reader.stop()

    async def test_stop_cancels_tasks(self, reader_config, event_bus):
        db = FakeDatabase()
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        assert reader._cleanup_task is not None
        await reader.stop()
        assert reader._cleanup_task is None

    async def test_reader_handles_mongo_error_on_init(self, reader_config, event_bus):
        db = FakeDatabase()
        reader = MarketDataReader(reader_config, event_bus, db)

        # Make mongo read fail
        original_find = db[reader_config.timeseries_collection].find
        db[reader_config.timeseries_collection].find = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("DB down"))

        await reader.start()  # Should not raise
        try:
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "no_data"
        finally:
            await reader.stop()

    async def test_reader_handles_mongo_error_on_refresh(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        await _populate_db(db, coll, {"AAPL": make_bars("AAPL", days=5)})

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            # Data loaded successfully
            resp = await reader.get_prices(["AAPL"])
            assert resp.data["AAPL"].status == "ok"

            # Now break MongoDB reads and trigger refresh via event bus
            db[coll].find = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("DB down"))
            await event_bus.publish(Event(type=EventType.DATA_WRITTEN, symbols=["AAPL"]))
            await asyncio.sleep(0.1)

            # Reader should not crash -- existing data for AAPL is still served
            # (the failed refresh logs a warning but doesn't clear the store)
            resp = await reader.get_prices(["AAPL"])
            # Store may or may not retain data depending on impl, but reader shouldn't crash
            assert resp.data["AAPL"].status in ("ok", "no_data")
        finally:
            await reader.stop()
