from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Literal, Any


class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema: dict[str, Any]) -> dict[str, Any]:
        field_schema.update(type="string")
        return field_schema

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)


class StockPrice(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    symbol: str
    price: float
    currency: str
    market: Literal["US", "TASE", "CURRENCY", "CRYPTO"]
    fetched_at: datetime
    date: str  # Trading date in YYYY-MM-DD format
    change_percent: float | None = None
    
    @field_validator('id', mode='before')
    @classmethod
    def validate_object_id(cls, v):
        if v is None:
            return PyObjectId()
        if isinstance(v, str):
            return PyObjectId(v)
        if isinstance(v, ObjectId):
            return PyObjectId(v)
        return v


class TrackedSymbol(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    symbol: str
    market: Literal["US", "TASE", "CURRENCY", "CRYPTO"]
    added_at: datetime
    last_queried_at: datetime
    
    @field_validator('id', mode='before')
    @classmethod
    def validate_object_id(cls, v):
        if v is None:
            return PyObjectId()
        if isinstance(v, str):
            return PyObjectId(v)
        if isinstance(v, ObjectId):
            return PyObjectId(v)
        return v


class PriceResponse(BaseModel):
    """Response model for price data"""
    symbol: str
    price: float
    change_percent: float | None = None
    currency: str
    market: str
    date: str
    fetched_at: datetime 