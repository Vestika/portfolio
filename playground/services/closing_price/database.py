import redis.asyncio as redis
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

from .config import settings


class Database:
    client: Optional[AsyncIOMotorClient] = None
    database = None


class Cache:
    redis_client: Optional[redis.Redis] = None


db = Database()
cache = Cache()


async def connect_to_mongo() -> None:
    """Create database connection"""
    try:
        db.client = AsyncIOMotorClient(settings.mongodb_url)
        db.database = db.client[settings.mongodb_database]
        
        # Test the connection
        await db.client.admin.command('ping')
        logger.info(f"Connected to MongoDB at {settings.mongodb_url}")
        
        # Create indexes
        await db.database.stock_prices.create_index([("symbol", 1), ("date", -1)])
        await db.database.tracked_symbols.create_index([("symbol", 1)], unique=True, name="symbol_1")
        await db.database.tracked_symbols.create_index([("last_queried_at", 1)])
        
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection() -> None:
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("Disconnected from MongoDB")


async def connect_to_redis() -> None:
    """Create Redis connection"""
    try:
        cache.redis_client = redis.from_url(
            settings.redis_url,
            db=settings.redis_db,
            decode_responses=True
        )
        
        # Test the connection
        await cache.redis_client.ping()
        logger.info(f"Connected to Redis at {settings.redis_url}")
        
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise


async def close_redis_connection() -> None:
    """Close Redis connection"""
    if cache.redis_client:
        await cache.redis_client.close()
        logger.info("Disconnected from Redis") 