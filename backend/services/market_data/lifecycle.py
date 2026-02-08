"""Lifecycle management -- single entry point for FastAPI."""

from __future__ import annotations

from loguru import logger
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.asynchronous.mongo_client import AsyncMongoClient

from .config import MarketDataConfig
from .event_bus.in_process import InProcessEventBus
from .mongo.collections import ensure_timeseries_collection
from .mongo.queries import migrate_historical_data
from .reader.reader import MarketDataReader
from .writer.fetchers.registry import FetcherRegistry
from .writer.fetchers.yahoo import YahooFinanceFetcher
from .writer.fetchers.tase import TASEFetcher
from .writer.rate_limiter import TokenBucketRateLimiter
from .writer.writer import MarketDataWriter


async def init_market_data_service(
    config: MarketDataConfig | None = None,
    db: AsyncDatabase | None = None,
) -> tuple[MarketDataReader, MarketDataWriter]:
    """Initialize and start both market data services.

    Returns ``(reader, writer)`` ready to serve.

    Parameters:
        config: Optional config; defaults to ``MarketDataConfig()``.
        db: Optional existing MongoDB database handle.  If not provided,
            a new ``AsyncMongoClient`` is created from config.

    Initialization order:

    1. Create EventBus (in-process)
    2. Connect to MongoDB and ensure time-series collection
    3. Migrate data from old ``historical_prices`` if new collection is empty
    4. Build fetcher registry with rate limiters
    5. Create and start MarketDataReader (loads all data from MongoDB into RAM)
    6. Create and start MarketDataWriter (queries reader for state, starts workers)
    """
    if config is None:
        config = MarketDataConfig()

    # 1. Event bus
    event_bus = InProcessEventBus()
    await event_bus.start()

    # 2. MongoDB
    if db is None:
        client = AsyncMongoClient(config.mongodb_url)
        db = client[config.mongodb_database]

    await ensure_timeseries_collection(
        db, config.timeseries_collection, config.mongo_expire_after_seconds
    )

    # 3. One-time migration from old historical_prices → new collection
    try:
        migrated = await migrate_historical_data(
            db,
            source_collection="historical_prices",
            target_collection=config.timeseries_collection,
        )
        if migrated > 0:
            logger.info(f"Migrated {migrated} docs from historical_prices → {config.timeseries_collection}")
    except Exception:
        logger.opt(exception=True).warning("Migration from historical_prices failed (non-fatal)")

    # 4. Fetcher registry
    registry = FetcherRegistry()

    yahoo_limiter = TokenBucketRateLimiter(config.rate_limits["yahoo"])
    registry.register("US", YahooFinanceFetcher(), yahoo_limiter)
    # Currency pairs also go through Yahoo
    registry.register("CURRENCY", YahooFinanceFetcher(), yahoo_limiter)

    tase_limiter = TokenBucketRateLimiter(config.rate_limits["tase"])
    registry.register("TASE", TASEFetcher(), tase_limiter)

    # 5. Reader
    reader = MarketDataReader(config, event_bus, db)
    await reader.start()
    logger.info("MarketDataReader started")

    # 6. Writer
    writer = MarketDataWriter(config, event_bus, reader, db, registry)
    await writer.start()
    logger.info("MarketDataWriter started")

    return reader, writer


async def shutdown_market_data_service(
    reader: MarketDataReader,
    writer: MarketDataWriter,
) -> None:
    """Graceful shutdown.  Writer stops first (drain queue), then reader."""
    await writer.stop()
    logger.info("MarketDataWriter stopped")
    await reader.stop()
    logger.info("MarketDataReader stopped")
