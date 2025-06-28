from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from services.closing_price.config import settings

class DatabaseService:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

    @classmethod
    async def connect_to_database(cls):
        cls.client = AsyncIOMotorClient(settings.mongodb_url)
        cls.db = cls.client[settings.mongodb_database]
        print("Connected to MongoDB!")

    @classmethod
    async def close_database_connection(cls):
        if cls.client:
            cls.client.close()
            print("Closed MongoDB connection!")

    @classmethod
    async def get_database(cls) -> AsyncIOMotorDatabase:
        return cls.db

    @classmethod
    async def get_collection(cls, name: str):
        db = await cls.get_database()
        return db[name]
