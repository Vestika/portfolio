from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from pymongo.errors import OperationFailure
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import redis.asyncio as redis
import fakeredis.aioredis as fakeredis
from config import settings


class Database:
    client: Optional[AsyncIOMotorClient] = None
    database = None


class Cache:
    redis_client: Optional[redis.Redis] = None


db = Database()
cache = Cache()

async def create_index_safe(
    collection: AsyncIOMotorCollection,
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
        print(f"[INDEX] Created index: {name} on {collection.name}")
    except OperationFailure as e:
        if e.code == 86:
            print(f"[INDEX] Conflict: index '{name}' already exists with different options")
        else:
            print(f"[INDEX] Error creating index '{name}': {e}")
    except Exception as e:
        print(f"[INDEX] Unexpected error creating index '{name}': {e}")


async def connect_to_mongo() -> None:
    """Create database connection"""
    try:
        db.client = AsyncIOMotorClient(settings.mongodb_url)
        db.database = db.client[settings.mongodb_database]
        
        # Test the connection
        await db.client.admin.command('ping')
        logger.info(f"Connected to MongoDB at {settings.mongodb_url}")

        await create_index_safe(
            collection=db.database.stock_prices,
            keys=[("symbol", 1), ("date", -1)],
            name="symbol_date_index"
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
        # Create indexes
        # await db.database.stock_prices.create_index([("symbol", 1), ("date", -1)])
        # await db.database.tracked_symbols.create_index([("symbol", 1)], unique=True, name="symbol_1")
        # await db.database.tracked_symbols.create_index([("last_queried_at", 1)])
        #
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection() -> None:
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("Disconnected from MongoDB")


async def connect_to_redis() -> None:
    """Create Redis or FakeRedis connection depending on config"""
    try:
        if settings.use_fake_redis:
            cache.redis_client = fakeredis.FakeRedis(decode_responses=True)
            logger.info("Using FakeRedis for in-memory caching")
        else:
            cache.redis_client = redis.from_url(
                settings.redis_url,
                db=settings.redis_db,
                decode_responses=True
            )
            logger.info(f"Connected to Redis at {settings.redis_url}")

        # Test the connection
        await cache.redis_client.ping()

    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise


async def close_redis_connection() -> None:
    """Close Redis connection"""
    if cache.redis_client:
        await cache.redis_client.close()
        logger.info("Disconnected from Redis") 