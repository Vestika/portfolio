"""Typed MongoDB query helpers for market data."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from loguru import logger
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import BulkWriteError

from ..models import HistoricalBar


async def read_all_historical(
    db: AsyncDatabase,
    collection: str,
    since: datetime,
) -> dict[str, list[HistoricalBar]]:
    """Read all bars since *since*, grouped by symbol.  Used by reader on init."""
    result: dict[str, list[HistoricalBar]] = defaultdict(list)
    cursor = db[collection].find(
        {"timestamp": {"$gte": since}},
        {"_id": 0, "symbol": 1, "timestamp": 1, "close": 1},
    ).sort("timestamp", 1)

    async for doc in cursor:
        bar = HistoricalBar(timestamp=doc["timestamp"], close=doc["close"])
        result[doc["symbol"]].append(bar)
    return dict(result)


async def read_symbols_historical(
    db: AsyncDatabase,
    collection: str,
    symbols: list[str],
    since: datetime,
) -> dict[str, list[HistoricalBar]]:
    """Read bars for specific *symbols*.  Used by reader on notification."""
    result: dict[str, list[HistoricalBar]] = {s: [] for s in symbols}
    cursor = db[collection].find(
        {"symbol": {"$in": symbols}, "timestamp": {"$gte": since}},
        {"_id": 0, "symbol": 1, "timestamp": 1, "close": 1},
    ).sort("timestamp", 1)

    async for doc in cursor:
        bar = HistoricalBar(timestamp=doc["timestamp"], close=doc["close"])
        result[doc["symbol"]].append(bar)
    return result


async def write_historical(
    db: AsyncDatabase,
    collection: str,
    symbol: str,
    bars: list[HistoricalBar],
) -> int:
    """Write bars, skipping duplicates.  Returns count of new records inserted."""
    if not bars:
        return 0

    existing = await get_existing_timestamps(db, collection, symbol)

    documents = []
    for bar in bars:
        if bar.timestamp not in existing:
            documents.append({
                "symbol": symbol,
                "timestamp": bar.timestamp,
                "close": bar.close,
            })

    if not documents:
        return 0

    try:
        result = await db[collection].insert_many(documents, ordered=False)
        inserted = len(result.inserted_ids)
        logger.debug(f"Inserted {inserted} new bars for {symbol}")
        return inserted
    except BulkWriteError as exc:
        # Some docs may have been inserted before the error
        inserted = exc.details.get("nInserted", 0)
        logger.warning(f"BulkWriteError for {symbol}: {inserted} inserted, errors: {exc.details.get('writeErrors', [])}")
        return inserted


async def get_existing_timestamps(
    db: AsyncDatabase,
    collection: str,
    symbol: str,
) -> set[datetime]:
    """Return all existing timestamps for *symbol* (for dedup before insert)."""
    cursor = db[collection].find(
        {"symbol": symbol},
        {"_id": 0, "timestamp": 1},
    )
    return {doc["timestamp"] async for doc in cursor}
