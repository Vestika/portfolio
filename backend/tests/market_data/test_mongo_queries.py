"""MongoDB query tests using FakeDatabase."""

from datetime import datetime, timedelta

import pytest

from services.market_data.models import HistoricalBar
from services.market_data.mongo.collections import ensure_timeseries_collection
from services.market_data.mongo.queries import (
    get_existing_timestamps,
    read_all_historical,
    read_symbols_historical,
    write_historical,
)
from tests.conftest import FakeDatabase, make_bars


COLLECTION = "market_data_prices"


def _bar(day_offset: int, close: float = 100.0) -> HistoricalBar:
    ts = datetime(2026, 1, 1, 20, 0) + timedelta(days=day_offset)
    return HistoricalBar(timestamp=ts, close=close)


class TestMongoQueries:
    async def test_write_and_read_historical(self):
        db = FakeDatabase()
        bars = [_bar(0, 100.0), _bar(1, 101.0), _bar(2, 102.0)]
        inserted = await write_historical(db, COLLECTION, "AAPL", bars)
        assert inserted == 3

        since = datetime(2026, 1, 1)
        result = await read_all_historical(db, COLLECTION, since)
        assert "AAPL" in result
        assert len(result["AAPL"]) == 3

    async def test_write_deduplicates(self):
        db = FakeDatabase()
        bars = [_bar(0, 100.0), _bar(1, 101.0)]
        await write_historical(db, COLLECTION, "AAPL", bars)
        # Write same bars again
        inserted = await write_historical(db, COLLECTION, "AAPL", bars)
        assert inserted == 0  # All deduplicated

    async def test_read_with_since_filter(self):
        db = FakeDatabase()
        bars = [_bar(i) for i in range(365)]
        await write_historical(db, COLLECTION, "AAPL", bars)

        since = datetime(2026, 1, 1, 20, 0) + timedelta(days=335)
        result = await read_all_historical(db, COLLECTION, since)
        assert len(result["AAPL"]) == 30  # days 335..364

    async def test_read_all_multiple_symbols(self):
        db = FakeDatabase()
        await write_historical(db, COLLECTION, "AAPL", [_bar(0), _bar(1)])
        await write_historical(db, COLLECTION, "MSFT", [_bar(0), _bar(1), _bar(2)])
        await write_historical(db, COLLECTION, "GOOG", [_bar(0)])

        since = datetime(2026, 1, 1)
        result = await read_all_historical(db, COLLECTION, since)
        assert len(result) == 3
        assert len(result["AAPL"]) == 2
        assert len(result["MSFT"]) == 3
        assert len(result["GOOG"]) == 1

    async def test_read_nonexistent_symbol(self):
        db = FakeDatabase()
        since = datetime(2026, 1, 1)
        result = await read_symbols_historical(db, COLLECTION, ["UNKNOWN"], since)
        assert result["UNKNOWN"] == []

    async def test_write_returns_insert_count(self):
        db = FakeDatabase()
        bars = [_bar(i) for i in range(10)]
        inserted = await write_historical(db, COLLECTION, "AAPL", bars)
        assert inserted == 10

        # Write 10 more, 5 overlap
        new_bars = [_bar(i) for i in range(5, 15)]
        inserted = await write_historical(db, COLLECTION, "AAPL", new_bars)
        assert inserted == 5  # Only days 10-14

    async def test_timeseries_collection_created(self):
        db = FakeDatabase()
        await ensure_timeseries_collection(db, "test_prices", 365 * 86400)
        names = await db.list_collection_names()
        assert "test_prices" in names

    async def test_indexes_created(self):
        db = FakeDatabase()
        await ensure_timeseries_collection(db, "test_prices", 365 * 86400)
        # FakeCollection.create_index is a no-op but shouldn't raise
        # This verifies the function runs without error
