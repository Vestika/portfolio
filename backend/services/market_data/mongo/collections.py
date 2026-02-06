"""MongoDB collection setup and index management."""

from __future__ import annotations

from loguru import logger
from pymongo.asynchronous.database import AsyncDatabase


async def ensure_timeseries_collection(
    db: AsyncDatabase,
    collection_name: str,
    expire_after_seconds: int,
) -> None:
    """Create the time-series collection if it doesn't exist.

    Time-series config:
      - ``timeField``: ``"timestamp"`` (the bar date)
      - ``metaField``: ``"symbol"`` (groups data per stock)
      - ``granularity``: ``"hours"`` (bars are daily; nearest option)
      - ``expireAfterSeconds``: configurable TTL (default 1 year)
    """
    existing = await db.list_collection_names()
    if collection_name not in existing:
        await db.create_collection(
            collection_name,
            timeseries={
                "timeField": "timestamp",
                "metaField": "symbol",
                "granularity": "hours",
            },
            expireAfterSeconds=expire_after_seconds,
        )
        logger.info(f"Created time-series collection '{collection_name}'")

    collection = db[collection_name]
    await collection.create_index("symbol")
    await collection.create_index([("symbol", 1), ("timestamp", -1)])
    logger.info(f"Ensured indexes on '{collection_name}'")
