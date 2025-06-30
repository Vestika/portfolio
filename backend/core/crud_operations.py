from datetime import datetime
from typing import Optional, List, Dict, Any, Type
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection
from models.base_model import BaseFeatureModel


class CRUDOperations:
    def __init__(self, collection: AsyncIOMotorCollection, model_class: Type[BaseFeatureModel]):
        self.collection = collection
        self.model_class = model_class

    async def create(self, data: Dict[str, Any]) -> str:
        """Create a new document"""
        document = data.copy()
        document['created_at'] = datetime.utcnow()
        document['updated_at'] = datetime.utcnow()

        result = await self.collection.insert_one(document)
        return str(result.inserted_id)

    async def get_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID"""
        try:
            document = await self.collection.find_one({"_id": ObjectId(id)})
            if document:
                document["_id"] = str(document["_id"])
            return document
        except:
            return None

    async def get_all(self, skip: int = 0, limit: int = 100, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get all documents with pagination"""
        query = filters or {}
        cursor = self.collection.find(query).skip(skip).limit(limit)
        documents = await cursor.to_list(length=limit)

        for doc in documents:
            doc["_id"] = str(doc["_id"])
        return documents

    async def update(self, id: str, data: Dict[str, Any]) -> bool:
        """Update document"""
        try:
            update_data = data.copy()
            update_data['updated_at'] = datetime.utcnow()

            result = await self.collection.update_one(
                {"_id": ObjectId(id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except:
            return False

    async def delete(self, id: str) -> bool:
        """Delete document"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(id)})
            return result.deleted_count > 0
        except:
            return False

    async def get_nested(self, parent_id: str, parent_field: str, skip: int = 0, limit: int = 100) -> List[
        Dict[str, Any]]:
        """Get nested documents by parent ID"""
        try:
            query = {parent_field: parent_id}
            cursor = self.collection.find(query).skip(skip).limit(limit)
            documents = await cursor.to_list(length=limit)

            for doc in documents:
                doc["_id"] = str(doc["_id"])
            return documents
        except:
            return []

    async def create_nested(self, parent_id: str, parent_field: str, data: Dict[str, Any]) -> str:
        """Create a nested document with parent reference"""
        document = data.copy()
        document[parent_field] = parent_id
        document['created_at'] = datetime.utcnow()
        document['updated_at'] = datetime.utcnow()

        result = await self.collection.insert_one(document)
        return str(result.inserted_id)

    async def update_nested(self, parent_id: str, nested_id: str, parent_field: str, data: Dict[str, Any]) -> bool:
        """Update nested document ensuring it belongs to parent"""
        try:
            update_data = data.copy()
            update_data['updated_at'] = datetime.utcnow()

            result = await self.collection.update_one(
                {"_id": ObjectId(nested_id), parent_field: parent_id},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except:
            return False

    async def delete_nested(self, parent_id: str, nested_id: str, parent_field: str) -> bool:
        """Delete nested document ensuring it belongs to parent"""
        try:
            result = await self.collection.delete_one({
                "_id": ObjectId(nested_id),
                parent_field: parent_id
            })
            return result.deleted_count > 0
        except:
            return False

    async def get_nested_by_id(self, parent_id: str, nested_id: str, parent_field: str) -> Optional[Dict[str, Any]]:
        """Get specific nested document by ID ensuring it belongs to parent"""
        try:
            document = await self.collection.find_one({
                "_id": ObjectId(nested_id),
                parent_field: parent_id
            })
            if document:
                document["_id"] = str(document["_id"])
            return document
        except:
            return None
