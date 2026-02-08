"""Typed MongoDB query helpers for market data."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime

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


async def read_tracked_symbols(
    db: AsyncDatabase,
    collection: str = "tracked_symbols",
) -> list[dict]:
    """Read all tracked symbols with their market and last_update.

    Returns list of dicts: ``[{symbol, market, last_update}, ...]``
    """
    result: list[dict] = []
    cursor = db[collection].find(
        {},
        {"_id": 0, "symbol": 1, "market": 1, "last_update": 1},
    )
    async for doc in cursor:
        result.append({
            "symbol": doc["symbol"],
            "market": doc.get("market", "US"),
            "last_update": doc.get("last_update"),
        })
    return result


async def update_tracked_symbol_last_update(
    db: AsyncDatabase,
    symbol: str,
    timestamp: datetime,
    collection: str = "tracked_symbols",
) -> None:
    """Update ``last_update`` field in tracked_symbols after a successful fetch."""
    await db[collection].update_one(
        {"symbol": symbol},
        {"$set": {"last_update": timestamp}},
    )


async def migrate_historical_data(
    db: AsyncDatabase,
    source_collection: str,
    target_collection: str,
) -> int:
    """One-time migration: copy data from old collection to new.

    Only runs if the target collection is empty.  Returns count of docs copied.
    """
    target_count = await db[target_collection].count_documents({})
    if target_count > 0:
        logger.info(f"Migration skipped: {target_collection} already has {target_count} docs")
        return 0

    source_count = await db[source_collection].count_documents({})
    if source_count == 0:
        logger.info(f"Migration skipped: {source_collection} is empty")
        return 0

    logger.info(f"Migrating {source_count} docs from {source_collection} → {target_collection}")
    copied = 0
    batch: list[dict] = []
    batch_size = 1000

    cursor = db[source_collection].find({}, {"_id": 0})
    async for doc in cursor:
        batch.append(doc)
        if len(batch) >= batch_size:
            await db[target_collection].insert_many(batch)
            copied += len(batch)
            batch = []

    if batch:
        await db[target_collection].insert_many(batch)
        copied += len(batch)

    logger.info(f"Migration complete: copied {copied} docs to {target_collection}")
    return copied


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
