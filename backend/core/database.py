import motor.motor_asyncio
import os


class DatabaseManager:
    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string or os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.client = None
        self.database = None

    async def connect(self, database_name: str = "vestika"):
        self.client = motor.motor_asyncio.AsyncIOMotorClient(self.connection_string)
        self.database = self.client[database_name]

    async def disconnect(self):
        if self.client:
            self.client.close()

    def get_collection(self, collection_name: str):
        return self.database[collection_name]


db_manager = DatabaseManager()
