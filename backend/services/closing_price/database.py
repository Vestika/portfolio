from loguru import logger
import asyncio
from pymongo.asynchronous.mongo_client import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.errors import OperationFailure
from typing import Optional
from config import settings


class Database:
    client: Optional[AsyncMongoClient] = None
    database = None
    loop: Optional[asyncio.AbstractEventLoop] = None
    indexes_created: bool = False  # Track if indexes have been created


db = Database()

async def create_index_safe(
    collection: AsyncCollection,
    keys: list[tuple[str, int]],
    *,
    name: str,
    unique: bool = False,
    **kwargs
):
    try:
        await collection.create_index(
            keys,
            name=name,
            unique=unique,
            **kwargs
        )
        logger.info(f"[INDEX] Created index: {name} on {collection.name}")
    except OperationFailure as e:
        if e.code == 86:
            logger.debug(f"[INDEX] Index '{name}' already exists")
        else:
            logger.error(f"[INDEX] Error creating index '{name}': {e}")
    except Exception as e:
        logger.error(f"[INDEX] Unexpected error creating index '{name}': {e}")


async def ensure_benchmark_symbols() -> None:
    """Ensure benchmark symbols like SPY are always tracked"""
    try:
        from datetime import datetime
        from services.closing_price.models import TrackedSymbol
        
        benchmark_symbols = [
            {"symbol": "SPY", "market": "US"}  # S&P 500 ETF
        ]
        
        for benchmark in benchmark_symbols:
            symbol = benchmark["symbol"]
            market = benchmark["market"]
            
            # Check if already tracked
            existing = await db.database.tracked_symbols.find_one({"symbol": symbol})
            if not existing:
                # Add to tracking
                now = datetime.utcnow()
                tracked_symbol = TrackedSymbol(
                    symbol=symbol,
                    market=market,
                    added_at=now,
                    last_queried_at=now
                )

                await db.database.tracked_symbols.insert_one(tracked_symbol.dict(by_alias=True))
                logger.info(f"[BENCHMARK] Added {symbol} to tracking as benchmark symbol")
                # Historical backfill handled by market_data writer on startup
            else:
                logger.debug(f"[BENCHMARK] {symbol} already tracked")
                
    except Exception as e:
        logger.error(f"[BENCHMARK] Error ensuring benchmark symbols: {e}")


async def create_database_indexes() -> None:
    """Create database indexes - should only be called once during startup"""
    if db.indexes_created or db.database is None:
        return

    logger.info("[INDEX] Creating database indexes...")

    # stock_prices: unique index on symbol (one doc per symbol with upsert)
    await create_index_safe(
        collection=db.database.stock_prices,
        keys=[("symbol", 1)],
        name="symbol_unique_index",
        unique=True
    )
    
    # stock_prices: TTL index to auto-expire old prices after 7 days (safety net)
    await create_index_safe(
        collection=db.database.stock_prices,
        keys=[("fetched_at", 1)],
        name="fetched_at_ttl_index",
        expireAfterSeconds=604800  # 7 days
    )

    await create_index_safe(
        collection=db.database.tracked_symbols,
        keys=[("symbol", 1)],
        name="unique_symbol_index",
        unique=True
    )

    await create_index_safe(
        collection=db.database.tracked_symbols,
        keys=[("last_queried_at", 1)],
        name="last_queried_at_index"
    )
    
    # Add index for last_update to support cron job queries
    await create_index_safe(
        collection=db.database.tracked_symbols,
        keys=[("last_update", 1)],
        name="last_update_index"
    )
    
    # Create indexes for earnings cache (with TTL expiration)
    await create_index_safe(
        collection=db.database.earnings_cache,
        keys=[("symbol", 1)],
        name="symbol_index",
        unique=True
    )
    
    # TTL index to auto-expire earnings after 24 hours
    await create_index_safe(
        collection=db.database.earnings_cache,
        keys=[("expires_at", 1)],
        name="expires_at_ttl_index",
        expireAfterSeconds=0  # Expire at the expires_at time
    )
    
    db.indexes_created = True
    logger.info("[INDEX] Database indexes creation completed")
    
    # Ensure benchmark symbols are always tracked
    await ensure_benchmark_symbols()


async def connect_to_mongo() -> None:
    """Create database connection"""
    try:
        db.client = AsyncMongoClient(settings.mongodb_url)
        db.database = db.client[settings.mongodb_database]
        db.loop = asyncio.get_running_loop()
        
        # Test the connection
        await db.client.admin.command('ping')
        logger.info(f"Connected to MongoDB at {settings.mongodb_url}")
        
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection() -> None:
    """Close database connection"""
    if db.client:
        await db.client.close()
        logger.info("Disconnected from MongoDB")


async def ensure_mongo_connection() -> None:
    """Ensure MongoDB client is bound to the current event loop."""
    try:
        current_loop = asyncio.get_running_loop()
        if db.client is None or db.loop is not current_loop:
            if db.client:
                try:
                    await db.client.close()
                except Exception:
                    pass
            await connect_to_mongo()
            # Note: Indexes are created separately during app startup, not here
    except RuntimeError:
        # No running loop; ignore here (should not happen in async context)
        pass


async def ensure_connections() -> None:
    """Ensure MongoDB is connected in the current event loop."""
    await ensure_mongo_connection()