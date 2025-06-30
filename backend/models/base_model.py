from typing import Optional, Dict, Any, List, Callable
from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId
from enum import Enum


class AuthType(str, Enum):
    NONE = "none"
    BASIC = "basic"
    BEARER = "bearer"
    API_KEY = "api_key"


class NestedRelation(BaseModel):
    """Configuration for nested relationships"""
    parent_field: str  # Field in this model that references parent
    parent_collection: str  # Parent collection name
    route_name: str  # Name for the nested route (e.g., "colors", "reviews")


class FeatureConfig(BaseModel):
    """Configuration for auto-generated features"""
    collection_name: str
    auth_required: AuthType = AuthType.NONE
    enable_create: bool = True
    enable_read: bool = True
    enable_update: bool = True
    enable_delete: bool = True
    enable_list: bool = True
    async_operations: bool = True
    custom_validators: Dict[str, Callable] = {}
    pre_hooks: Dict[str, List[Callable]] = {}
    post_hooks: Dict[str, List[Callable]] = {}
    custom_fields: Dict[str, Any] = {}
    # New nested relationship configuration
    nested_under: Optional[NestedRelation] = None
    nested_children: List[str] = []  # List of child model class names


class BaseFeatureModel(BaseModel):
    """Base model that all feature models should inherit from"""
    id: Optional[str] = Field(default=None, alias="_id")
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        """Override this method to provide feature configuration"""
        return FeatureConfig(collection_name=cls.__name__.lower())
