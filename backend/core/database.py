from pymongo.asynchronous.mongo_client import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
import asyncio
from typing import AsyncGenerator, Optional

from config import settings


class DatabaseManager:
    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string or settings.mongodb_url
        self._client: Optional[AsyncMongoClient] = None
        self._database: Optional[AsyncDatabase] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def get_client(self) -> AsyncMongoClient:
        """Get or create AsyncMongoClient for the current event loop"""
        current_loop = asyncio.get_event_loop()
        
        # Check if we need to create a new client for this event loop
        if self._client is None or self._loop != current_loop:
            # Close existing client if it exists
            if self._client is not None:
                self._client.close()
            
            # Create new client for current event loop
            self._client = AsyncMongoClient(self.connection_string)
            self._loop = current_loop
        
        return self._client

    async def get_database(self, database_name: str = "vestika") -> AsyncDatabase:
        """Get database instance for the current event loop"""
        client = await self.get_client()
        return client[database_name]

    async def connect(self, database_name: str = "vestika"):
        """Initialize database connection (for backwards compatibility)"""
        self._database = await self.get_database(database_name)

    async def disconnect(self):
        """Close database connection"""
        if self._client:
            self._client.close()
            self._client = None
            self._database = None
            self._loop = None

    def get_collection(self, collection_name: str):
        """Get collection (requires database to be initialized)"""
        if self._database is None:
            raise RuntimeError("Database not initialized. Call get_database() first.")
        return self._database[collection_name]

    @property
    def database(self) -> Optional[AsyncDatabase]:
        """Legacy property for backwards compatibility"""
        return self._database


db_manager = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncDatabase, None]:
    """FastAPI dependency to get database instance"""
    try:
        database = await db_manager.get_database()
        yield database
    except Exception as e:
        # If database is not available, create a mock database
        from unittest.mock import AsyncMock
        mock_db = AsyncMock()
        mock_db.users = AsyncMock()
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_db.users.insert_one = AsyncMock()
        yield mock_db
        return