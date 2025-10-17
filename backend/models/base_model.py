from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId


class BaseFeatureModel(BaseModel):
    """Base model that all feature models should inherit from"""
    id: Optional[str] = Field(default=None, alias="_id")
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
