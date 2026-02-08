"""Tests for reader compat methods and mongo tracked_symbols queries."""

import asyncio
from datetime import date, datetime, timedelta

import pytest

from services.market_data.config import MarketDataConfig, RateLimitConfig
from services.market_data.event_bus.in_process import InProcessEventBus
from services.market_data.models import HistoricalBar
from services.market_data.mongo.queries import (
    migrate_historical_data,
    read_tracked_symbols,
    update_tracked_symbol_last_update,
    write_historical,
)
from services.market_data.reader.reader import MarketDataReader
from tests.conftest import FakeDatabase, make_bars


COLLECTION = "market_data_prices"


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
    for symbol, bars in symbols.items():
        docs = [{"symbol": symbol, "timestamp": b.timestamp, "close": b.close} for b in bars]
        if docs:
            await db[collection].insert_many(docs)


# ---------------------------------------------------------------------------
# read_tracked_symbols
# ---------------------------------------------------------------------------


class TestReadTrackedSymbols:
    async def test_read_empty(self):
        db = FakeDatabase()
        result = await read_tracked_symbols(db)
        assert result == []

    async def test_read_returns_symbol_and_market(self):
        db = FakeDatabase()
        await db["tracked_symbols"].insert_many([
            {"symbol": "AAPL", "market": "US", "last_update": None},
            {"symbol": "1234", "market": "TASE", "last_update": datetime(2026, 1, 1)},
        ])
        result = await read_tracked_symbols(db)
        assert len(result) == 2
        by_symbol = {r["symbol"]: r for r in result}
        assert by_symbol["AAPL"]["market"] == "US"
        assert by_symbol["AAPL"]["last_update"] is None
        assert by_symbol["1234"]["market"] == "TASE"
        assert by_symbol["1234"]["last_update"] == datetime(2026, 1, 1)

    async def test_defaults_market_to_us(self):
        db = FakeDatabase()
        await db["tracked_symbols"].insert_many([
            {"symbol": "MSFT"},  # no market field
        ])
        result = await read_tracked_symbols(db)
        assert result[0]["market"] == "US"


# ---------------------------------------------------------------------------
# update_tracked_symbol_last_update
# ---------------------------------------------------------------------------


class TestUpdateTrackedSymbolLastUpdate:
    async def test_updates_existing_symbol(self):
        db = FakeDatabase()
        await db["tracked_symbols"].insert_many([
            {"symbol": "AAPL", "market": "US", "last_update": None},
        ])
        now = datetime(2026, 2, 7, 12, 0)
        await update_tracked_symbol_last_update(db, "AAPL", now)

        doc = await db["tracked_symbols"].find_one({"symbol": "AAPL"})
        assert doc["last_update"] == now


# ---------------------------------------------------------------------------
# migrate_historical_data
# ---------------------------------------------------------------------------


class TestMigrateHistoricalData:
    async def test_copies_data_when_target_empty(self):
        db = FakeDatabase()
        await db["historical_prices"].insert_many([
            {"symbol": "AAPL", "timestamp": datetime(2026, 1, 1), "close": 150.0},
            {"symbol": "AAPL", "timestamp": datetime(2026, 1, 2), "close": 151.0},
            {"symbol": "MSFT", "timestamp": datetime(2026, 1, 1), "close": 300.0},
        ])
        copied = await migrate_historical_data(db, "historical_prices", "market_data_prices")
        assert copied == 3

        count = await db["market_data_prices"].count_documents({})
        assert count == 3

    async def test_skips_when_target_has_data(self):
        db = FakeDatabase()
        await db["historical_prices"].insert_many([
            {"symbol": "AAPL", "timestamp": datetime(2026, 1, 1), "close": 150.0},
        ])
        await db["market_data_prices"].insert_many([
            {"symbol": "MSFT", "timestamp": datetime(2026, 1, 1), "close": 300.0},
        ])
        copied = await migrate_historical_data(db, "historical_prices", "market_data_prices")
        assert copied == 0

    async def test_skips_when_source_empty(self):
        db = FakeDatabase()
        copied = await migrate_historical_data(db, "historical_prices", "market_data_prices")
        assert copied == 0


# ---------------------------------------------------------------------------
# Reader: get_tracked_symbols
# ---------------------------------------------------------------------------


class TestReaderGetTrackedSymbols:
    async def test_loads_tracked_symbols_on_start(self, reader_config, event_bus):
        db = FakeDatabase()
        await db["tracked_symbols"].insert_many([
            {"symbol": "AAPL", "market": "US", "last_update": None},
            {"symbol": "MSFT", "market": "US", "last_update": None},
        ])
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            tracked = await reader.get_tracked_symbols()
            assert tracked == {"AAPL": "US", "MSFT": "US"}
        finally:
            await reader.stop()

    async def test_returns_empty_when_no_tracked(self, reader_config, event_bus):
        db = FakeDatabase()
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            tracked = await reader.get_tracked_symbols()
            assert tracked == {}
        finally:
            await reader.stop()


# ---------------------------------------------------------------------------
# Reader: get_historical_prices (compat)
# ---------------------------------------------------------------------------


class TestReaderGetHistoricalPrices:
    async def test_returns_old_format(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        bars = make_bars("AAPL", days=5)
        await _populate_db(db, coll, {"AAPL": bars})

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            result = await reader.get_historical_prices(["AAPL"], days=365)
            assert "AAPL" in result
            assert len(result["AAPL"]) == 5
            # Check format: list of {"date": str, "price": float}
            entry = result["AAPL"][0]
            assert "date" in entry
            assert "price" in entry
            assert isinstance(entry["date"], str)
            assert isinstance(entry["price"], float)
        finally:
            await reader.stop()

    async def test_missing_symbol_returns_empty_list(self, reader_config, event_bus):
        db = FakeDatabase()
        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            result = await reader.get_historical_prices(["UNKNOWN"])
            assert result["UNKNOWN"] == []
        finally:
            await reader.stop()

    async def test_respects_days_param(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        bars = make_bars("AAPL", days=30)
        await _populate_db(db, coll, {"AAPL": bars})

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            result = await reader.get_historical_prices(["AAPL"], days=10)
            # Should only return bars from the last 10 days
            assert len(result["AAPL"]) <= 11  # allow some fuzz for date boundaries
            assert len(result["AAPL"]) >= 9
        finally:
            await reader.stop()

    async def test_multiple_symbols(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        await _populate_db(db, coll, {
            "AAPL": make_bars("AAPL", days=5),
            "MSFT": make_bars("MSFT", days=3),
        })

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            result = await reader.get_historical_prices(["AAPL", "MSFT", "GOOG"])
            assert len(result["AAPL"]) == 5
            assert len(result["MSFT"]) == 3
            assert result["GOOG"] == []
        finally:
            await reader.stop()

    async def test_date_format_is_yyyy_mm_dd(self, reader_config, event_bus):
        db = FakeDatabase()
        coll = reader_config.timeseries_collection
        bars = make_bars("AAPL", days=1)
        await _populate_db(db, coll, {"AAPL": bars})

        reader = MarketDataReader(reader_config, event_bus, db)
        await reader.start()
        try:
            result = await reader.get_historical_prices(["AAPL"])
            date_str = result["AAPL"][0]["date"]
            # Verify it's parseable and in correct format
            parsed = datetime.strptime(date_str, "%Y-%m-%d")
            assert parsed is not None
        finally:
            await reader.stop()
