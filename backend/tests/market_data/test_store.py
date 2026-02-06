"""InMemoryPriceStore unit tests."""

import asyncio
from datetime import date, datetime, timedelta

import pytest

from services.market_data.models import HistoricalBar
from services.market_data.reader.store import InMemoryPriceStore
from tests.conftest import make_bars


@pytest.fixture
def store() -> InMemoryPriceStore:
    return InMemoryPriceStore()


class TestInMemoryPriceStore:
    async def test_load_and_get_single_symbol(self, store: InMemoryPriceStore):
        bars = make_bars("AAPL", days=10)
        await store.load("AAPL", bars)
        result = store.get(["AAPL"])
        assert result["AAPL"].status == "ok"
        assert len(result["AAPL"].bars) == 10
        # Verify sorted ascending
        timestamps = [b.timestamp for b in result["AAPL"].bars]
        assert timestamps == sorted(timestamps)

    async def test_load_many_bulk(self, store: InMemoryPriceStore):
        data = {f"SYM{i}": make_bars(f"SYM{i}", days=5) for i in range(100)}
        await store.load_many(data)
        assert len(store.symbols()) == 100
        result = store.get(["SYM0", "SYM99"])
        assert result["SYM0"].status == "ok"
        assert result["SYM99"].status == "ok"

    async def test_get_missing_symbol_returns_no_data(self, store: InMemoryPriceStore):
        result = store.get(["UNKNOWN"])
        assert result["UNKNOWN"].status == "no_data"
        assert result["UNKNOWN"].bars == []

    async def test_get_mixed_existing_and_missing(self, store: InMemoryPriceStore):
        await store.load("AAPL", make_bars("AAPL", days=5))
        result = store.get(["AAPL", "UNKNOWN"])
        assert result["AAPL"].status == "ok"
        assert result["UNKNOWN"].status == "no_data"

    async def test_get_with_since_date_filter(self, store: InMemoryPriceStore):
        bars = make_bars("AAPL", days=365)
        await store.load("AAPL", bars)
        since = date.today() - timedelta(days=30)
        result = store.get(["AAPL"], since_date=since)
        assert all(b.timestamp.date() >= since for b in result["AAPL"].bars)
        assert len(result["AAPL"].bars) <= 31

    async def test_get_last_dates(self, store: InMemoryPriceStore):
        await store.load("AAPL", make_bars("AAPL", days=10))
        await store.load("MSFT", make_bars("MSFT", days=5))
        last_dates = store.get_last_dates(["AAPL", "MSFT"])
        assert "AAPL" in last_dates
        assert "MSFT" in last_dates

    async def test_get_last_dates_all_symbols(self, store: InMemoryPriceStore):
        await store.load("AAPL", make_bars("AAPL", days=5))
        await store.load("MSFT", make_bars("MSFT", days=5))
        last_dates = store.get_last_dates()
        assert set(last_dates.keys()) == {"AAPL", "MSFT"}

    async def test_discard_before(self, store: InMemoryPriceStore):
        bars = make_bars("AAPL", days=365)
        await store.load("AAPL", bars)
        cutoff = date.today() - timedelta(days=180)
        await store.discard_before(cutoff)
        result = store.get(["AAPL"])
        assert all(b.timestamp.date() >= cutoff for b in result["AAPL"].bars)

    async def test_discard_before_removes_empty_symbols(self, store: InMemoryPriceStore):
        # All bars are in the past beyond cutoff
        old_start = date.today() - timedelta(days=400)
        bars = make_bars("OLD", days=10, start=old_start)
        await store.load("OLD", bars)
        cutoff = date.today() - timedelta(days=100)
        await store.discard_before(cutoff)
        assert "OLD" not in store.symbols()
        result = store.get(["OLD"])
        assert result["OLD"].status == "no_data"

    async def test_load_replaces_existing(self, store: InMemoryPriceStore):
        await store.load("AAPL", make_bars("AAPL", days=10))
        new_bars = [HistoricalBar(timestamp=datetime(2020, 1, 1, 20, 0), close=999.0)]
        await store.load("AAPL", new_bars)
        result = store.get(["AAPL"])
        assert len(result["AAPL"].bars) == 1
        assert result["AAPL"].bars[0].close == 999.0

    async def test_symbols_set(self, store: InMemoryPriceStore):
        await store.load("AAPL", make_bars("AAPL", days=5))
        await store.load("MSFT", make_bars("MSFT", days=5))
        assert store.symbols() == {"AAPL", "MSFT"}

    async def test_clear(self, store: InMemoryPriceStore):
        await store.load("AAPL", make_bars("AAPL", days=5))
        await store.clear()
        assert store.symbols() == set()

    async def test_concurrent_reads_during_write(self, store: InMemoryPriceStore):
        await store.load("AAPL", make_bars("AAPL", days=100))

        errors: list[Exception] = []

        async def reader():
            for _ in range(50):
                try:
                    store.get(["AAPL"])
                except Exception as e:
                    errors.append(e)
                await asyncio.sleep(0)

        async def writer():
            for i in range(50):
                try:
                    await store.load("AAPL", make_bars("AAPL", days=100))
                except Exception as e:
                    errors.append(e)

        await asyncio.gather(reader(), writer())
        assert errors == []

    async def test_empty_store_returns_no_data(self, store: InMemoryPriceStore):
        result = store.get(["ANYTHING"])
        assert result["ANYTHING"].status == "no_data"
