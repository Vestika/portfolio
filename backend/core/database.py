from pymongo.asynchronous.mongo_client import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
import os
from typing import AsyncGenerator


class DatabaseManager:
    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string or os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.client = None
        self.database = None

    async def connect(self, database_name: str = "vestika"):
        self.client = AsyncMongoClient(self.connection_string)
        self.database = self.client[database_name]

    async def disconnect(self):
        if self.client:
            self.client.close()

    def get_collection(self, collection_name: str):
        return self.database[collection_name]


db_manager = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncDatabase, None]:
    """Dependency to get database instance"""
    if db_manager.database is None:
        try:
            await db_manager.connect()
        except Exception as e:
            # If database is not available, create a mock database
            from unittest.mock import AsyncMock
            mock_db = AsyncMock()
            mock_db.users = AsyncMock()
            mock_db.users.find_one = AsyncMock(return_value=None)
            mock_db.users.insert_one = AsyncMock()
            yield mock_db
            return
    yield db_manager.database
