from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.encoders import jsonable_encoder
from typing import Type, TypeVar, Generic, List, Callable
from motor.motor_asyncio import AsyncIOMotorCollection
from pydantic import BaseModel
from bson import ObjectId

from services.database_service import DatabaseService

# Type variables for schemas
CreateSchema = TypeVar("CreateSchema", bound=BaseModel)
ReadSchema = TypeVar("ReadSchema", bound=BaseModel)
UpdateSchema = TypeVar("UpdateSchema", bound=BaseModel)


# Dependency to fetch collection
def get_collection_factory(name: str) -> Callable[[], AsyncIOMotorCollection]:
    async def get_collection() -> AsyncIOMotorCollection:
        return await DatabaseService.get_collection(name)
    return get_collection


class MongoResourceEndpoint(Generic[CreateSchema, ReadSchema, UpdateSchema]):
    def __init__(
        self,
        *,
        collection_name: str,
        parent_keys: List[str],
        item_key: str,
        create_schema: Type[CreateSchema],
        read_schema: Type[ReadSchema],
        update_schema: Type[UpdateSchema],
        methods: List[str] = ["GET", "POST", "PUT", "DELETE"],
        requires_auth: bool = False  # placeholder if you want auth in future
    ):
        self.collection_name = collection_name
        self.collection_dep = Depends(get_collection_factory(collection_name))
        self.parent_keys = parent_keys
        self.item_key = item_key
        self.create_schema = create_schema
        self.read_schema = read_schema
        self.update_schema = update_schema
        self.methods = set(methods)
        self.router = APIRouter()
        self.setup_routes()

    def _build_path(self, with_id: bool) -> str:
        path = "".join([f"/{{{k}}}" for k in self.parent_keys])
        path += f"/{self.collection_name}"
        if with_id:
            path += f"/{{{self.item_key}}}"
        return path

    def _build_query(self, **kwargs) -> dict:
        query = {k: kwargs[k] for k in self.parent_keys}
        query["_id"] = ObjectId(kwargs[self.item_key])
        return query

    def setup_routes(self):
        if "POST" in self.methods:
            self.router.post(
                self._build_path(with_id=False),
                response_model=self.read_schema
            )(self.create_item)

        if "GET" in self.methods:
            self.router.get(
                self._build_path(with_id=True),
                response_model=self.read_schema
            )(self.get_item)

            self.router.get(
                self._build_path(with_id=False),
                response_model=List[self.read_schema]
            )(self.list_items)

        if "PUT" in self.methods:
            self.router.put(
                self._build_path(with_id=True),
                response_model=self.read_schema
            )(self.update_item)

        if "DELETE" in self.methods:
            self.router.delete(
                self._build_path(with_id=True)
            )(self.delete_item)

    # -----------------------------
    # CRUD Handlers
    # -----------------------------

    async def create_item(
        self,
        item: CreateSchema = Body(...),
        collection: AsyncIOMotorCollection = Depends(get_collection_factory("")),
        **kwargs
    ):
        data = jsonable_encoder(item)
        for key in self.parent_keys:
            data[key] = kwargs[key]
        result = await collection.insert_one(data)
        data["_id"] = result.inserted_id
        return self.read_schema(**data)

    async def get_item(
        self,
        collection: AsyncIOMotorCollection = Depends(get_collection_factory("")),
        **kwargs
    ):
        query = self._build_query(**kwargs)
        result = await collection.find_one(query)
        if not result:
            raise HTTPException(status_code=404, detail="Item not found")
        return self.read_schema(**result)

    async def update_item(
        self,
        item: UpdateSchema = Body(...),
        collection: AsyncIOMotorCollection = Depends(get_collection_factory("")),
        **kwargs
    ):
        query = self._build_query(**kwargs)
        update_data = jsonable_encoder(item, exclude_unset=True)
        result = await collection.find_one_and_update(
            query,
            {"$set": update_data},
            return_document=True
        )
        if not result:
            raise HTTPException(status_code=404, detail="Item not found")
        return self.read_schema(**result)

    async def delete_item(
        self,
        collection: AsyncIOMotorCollection = Depends(get_collection_factory("")),
        **kwargs
    ):
        query = self._build_query(**kwargs)
        result = await collection.delete_one(query)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"deleted": True}

    async def list_items(
        self,
        collection: AsyncIOMotorCollection = Depends(get_collection_factory("")),
        **kwargs
    ):
        query = {k: kwargs[k] for k in self.parent_keys}
        cursor = collection.find(query)
        results = [self.read_schema(**doc) async for doc in cursor]
        return results
