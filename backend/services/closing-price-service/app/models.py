from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Literal


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")


class StockPrice(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    symbol: str
    price: float
    currency: str
    market: Literal["US", "TASE"]
    fetched_at: datetime
    date: str  # Trading date in YYYY-MM-DD format
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class TrackedSymbol(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    symbol: str
    market: Literal["US", "TASE"]
    added_at: datetime
    last_queried_at: datetime
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class PriceResponse(BaseModel):
    symbol: str
    price: float
    currency: str
    market: str
    date: str
    fetched_at: datetime


class TrackSymbolsRequest(BaseModel):
    symbols: list[str]


class RefreshResponse(BaseModel):
    message: str
    refreshed_count: int
    not_refreshed_count: int
    failed_symbols: list[str]