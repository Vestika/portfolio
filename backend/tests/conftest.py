"""Shared fixtures for market_data tests."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.market_data.config import MarketDataConfig, RateLimitConfig
from services.market_data.event_bus.in_process import InProcessEventBus
from services.market_data.models import HistoricalBar


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_bars(symbol: str, days: int = 30, start: date | None = None) -> list[HistoricalBar]:
    """Generate *days* daily bars ending today (or at *start* + days)."""
    if start is None:
        start = date.today() - timedelta(days=days - 1)
    bars: list[HistoricalBar] = []
    for i in range(days):
        d = start + timedelta(days=i)
        ts = datetime.combine(d, datetime.min.time()).replace(hour=20, minute=0)
        bars.append(HistoricalBar(timestamp=ts, close=round(100.0 + i * 0.5, 2)))
    return bars


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@pytest.fixture
def config() -> MarketDataConfig:
    return MarketDataConfig(
        retention_days=365,
        backfill_staleness_days=3,
        max_concurrent_fetches=2,
        max_retries=2,
        retry_delay_seconds=0.01,
        rate_limits={
            "yahoo": RateLimitConfig(requests_per_second=100.0, burst_size=100, cooldown_seconds=0.01),
            "tase": RateLimitConfig(requests_per_second=100.0, burst_size=100, cooldown_seconds=0.01),
        },
    )


# ---------------------------------------------------------------------------
# Event bus
# ---------------------------------------------------------------------------

@pytest.fixture
async def event_bus() -> InProcessEventBus:
    bus = InProcessEventBus()
    await bus.start()
    yield bus
    await bus.stop()


# ---------------------------------------------------------------------------
# Mock MongoDB
# ---------------------------------------------------------------------------

class FakeCollection:
    """Minimal in-memory MongoDB collection mock supporting async iteration."""

    def __init__(self) -> None:
        self._docs: list[dict] = []

    async def insert_many(self, docs: list[dict], **kwargs) -> MagicMock:
        inserted_ids = []
        for doc in docs:
            self._docs.append(dict(doc))
            inserted_ids.append(id(doc))
        result = MagicMock()
        result.inserted_ids = inserted_ids
        return result

    def find(self, filter_: dict | None = None, projection: dict | None = None):
        """Return a chainable cursor-like object."""
        docs = list(self._docs)
        if filter_:
            docs = [d for d in docs if self._matches(d, filter_)]
        if projection:
            docs = [{k: d[k] for k in d if k in projection or k == "_id"} for d in docs]
            if projection.get("_id") == 0:
                docs = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
        return _FakeCursor(docs)

    async def find_one(self, filter_: dict | None = None, **kwargs):
        for d in self._docs:
            if filter_ is None or self._matches(d, filter_):
                return d
        return None

    async def count_documents(self, filter_: dict | None = None) -> int:
        if filter_ is None:
            return len(self._docs)
        return sum(1 for d in self._docs if self._matches(d, filter_))

    async def create_index(self, *args, **kwargs):
        pass

    @staticmethod
    def _matches(doc: dict, filter_: dict) -> bool:
        for key, val in filter_.items():
            if key == "$or":
                if not any(FakeCollection._matches(doc, sub) for sub in val):
                    return False
                continue
            doc_val = doc.get(key)
            if isinstance(val, dict):
                for op, operand in val.items():
                    if op == "$gte" and not (doc_val is not None and doc_val >= operand):
                        return False
                    if op == "$in" and doc_val not in operand:
                        return False
            else:
                if doc_val != val:
                    return False
        return True


class _FakeCursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs
        self._sorted = False

    def sort(self, key, direction=1):
        if isinstance(key, str):
            self._docs.sort(key=lambda d: d.get(key, 0), reverse=(direction == -1))
        elif isinstance(key, list):
            k, d = key[0]
            self._docs.sort(key=lambda doc: doc.get(k, 0), reverse=(d == -1))
        return self

    async def to_list(self, length=None):
        return self._docs[:length] if length else list(self._docs)

    def __aiter__(self):
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class FakeDatabase:
    """Dict-like mock for ``db[collection_name]``."""

    def __init__(self) -> None:
        self._collections: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        if name not in self._collections:
            self._collections[name] = FakeCollection()
        return self._collections[name]

    async def list_collection_names(self) -> list[str]:
        return list(self._collections.keys())

    async def create_collection(self, name: str, **kwargs):
        self._collections[name] = FakeCollection()


@pytest.fixture
def fake_db() -> FakeDatabase:
    return FakeDatabase()
