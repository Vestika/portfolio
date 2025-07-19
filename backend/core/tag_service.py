from typing import Dict, List, Optional, Any
from datetime import datetime
from pymongo.asynchronous.database import AsyncDatabase
from bson import ObjectId
import logging

from models.tag_models import (
    TagDefinition, TagValue, HoldingTags, TagLibrary, 
    TagType, ScalarDataType, DEFAULT_TAG_TEMPLATES
)

logger = logging.getLogger(__name__)

class TagService:
    def __init__(self, db: AsyncDatabase):
        self.db = db
        self.tag_libraries_collection = db["tag_libraries"]
        self.holding_tags_collection = db["holding_tags"]

    async def get_user_tag_library(self, user_id: str) -> TagLibrary:
        """Get or create a user's tag library"""
        existing = await self.tag_libraries_collection.find_one({"user_id": user_id})
        
        if existing:
            # Convert MongoDB document to TagLibrary
            existing["id"] = str(existing["_id"])
            del existing["_id"]
            return TagLibrary(**existing)
        else:
            # Create new tag library with default templates
            new_library = TagLibrary(
                user_id=user_id,
                tag_definitions={},
                template_tags=DEFAULT_TAG_TEMPLATES
            )
            
            # Save to database
            library_dict = new_library.dict(by_alias=True, exclude={"id"})
            result = await self.tag_libraries_collection.insert_one(library_dict)
            new_library.id = str(result.inserted_id)
            
            return new_library

    async def add_tag_definition(self, user_id: str, tag_definition: TagDefinition) -> TagDefinition:
        """Add or update a tag definition for a user"""
        tag_definition.user_id = user_id
        tag_definition.updated_at = datetime.utcnow()
        
        # Get user's tag library
        library = await self.get_user_tag_library(user_id)
        
        # Add the definition
        library.add_tag_definition(tag_definition)
        
        # Update in database
        await self.tag_libraries_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                f"tag_definitions.{tag_definition.name}": tag_definition.dict(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        return tag_definition

    async def delete_tag_definition(self, user_id: str, tag_name: str) -> bool:
        """Delete a tag definition and all associated tag values"""
        # First, remove all instances of this tag from holdings
        await self.holding_tags_collection.update_many(
            {"user_id": user_id},
            {"$unset": {f"tags.{tag_name}": ""}}
        )
        
        # Then remove the definition from the library
        result = await self.tag_libraries_collection.update_one(
            {"user_id": user_id},
            {"$unset": {f"tag_definitions.{tag_name}": ""}}
        )
        
        return result.modified_count > 0

    async def get_holding_tags(self, user_id: str, symbol: str, portfolio_id: Optional[str] = None) -> HoldingTags:
        """Get tags for a specific holding"""
        query = {"user_id": user_id, "symbol": symbol}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id
        
        existing = await self.holding_tags_collection.find_one(query)
        
        if existing:
            existing["id"] = str(existing["_id"])
            del existing["_id"]
            return HoldingTags(**existing)
        else:
            # Return empty tag collection
            return HoldingTags(
                symbol=symbol,
                user_id=user_id,
                portfolio_id=portfolio_id,
                tags={}
            )

    async def set_holding_tag(self, user_id: str, symbol: str, tag_name: str, tag_value: TagValue, portfolio_id: Optional[str] = None) -> HoldingTags:
        """Set a tag value for a holding"""
        # Validate that the tag definition exists
        library = await self.get_user_tag_library(user_id)
        tag_def = library.get_tag_definition(tag_name)
        
        # If not found in user definitions, check if it's a template
        if not tag_def and tag_name in DEFAULT_TAG_TEMPLATES:
            tag_def = DEFAULT_TAG_TEMPLATES[tag_name]
        
        if not tag_def:
            raise ValueError(f"Tag definition '{tag_name}' not found for user")
        
        # Validate tag value against definition (use template or custom definition)
        await self._validate_tag_value(tag_value, tag_def)
        
        tag_value.updated_at = datetime.utcnow()
        
        # Update or create holding tags
        query = {"user_id": user_id, "symbol": symbol}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id
        
        update_doc = {
            "$set": {
                f"tags.{tag_name}": tag_value.dict(),
                "updated_at": datetime.utcnow()
            },
            "$setOnInsert": {
                "user_id": user_id,
                "symbol": symbol,
                "portfolio_id": portfolio_id,
                "created_at": datetime.utcnow()
            }
        }
        
        await self.holding_tags_collection.update_one(
            query,
            update_doc,
            upsert=True
        )
        
        return await self.get_holding_tags(user_id, symbol, portfolio_id)

    async def remove_holding_tag(self, user_id: str, symbol: str, tag_name: str, portfolio_id: Optional[str] = None) -> bool:
        """Remove a tag from a holding"""
        query = {"user_id": user_id, "symbol": symbol}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id
        
        result = await self.holding_tags_collection.update_one(
            query,
            {"$unset": {f"tags.{tag_name}": ""}}
        )
        
        return result.modified_count > 0

    async def get_all_holding_tags(self, user_id: str, portfolio_id: Optional[str] = None) -> List[HoldingTags]:
        """Get tags for all holdings for a user"""
        query = {"user_id": user_id}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id
        
        cursor = self.holding_tags_collection.find(query)
        results = []
        
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            results.append(HoldingTags(**doc))
        
        return results

    async def search_holdings_by_tags(self, user_id: str, tag_filters: Dict[str, Any], portfolio_id: Optional[str] = None) -> List[str]:
        """Search for holding symbols that match tag criteria"""
        query = {"user_id": user_id}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id
        
        # Build MongoDB query for tag filters
        for tag_name, filter_value in tag_filters.items():
            if isinstance(filter_value, bool):
                query[f"tags.{tag_name}.boolean_value"] = filter_value
            elif isinstance(filter_value, str):
                query[f"tags.{tag_name}.enum_value"] = filter_value
            elif isinstance(filter_value, (int, float)):
                query[f"tags.{tag_name}.scalar_value"] = filter_value
            elif isinstance(filter_value, dict):
                # For range queries, map operations, etc.
                for op, value in filter_value.items():
                    if op == "gte":
                        query[f"tags.{tag_name}.scalar_value"] = {"$gte": value}
                    elif op == "lte":
                        query[f"tags.{tag_name}.scalar_value"] = {"$lte": value}
                    elif op == "contains":
                        query[f"tags.{tag_name}.map_value.{value}"] = {"$exists": True}
        
        cursor = self.holding_tags_collection.find(query, {"symbol": 1})
        symbols = []
        
        async for doc in cursor:
            symbols.append(doc["symbol"])
        
        return symbols

    async def get_tag_aggregations(self, user_id: str, tag_name: str, portfolio_id: Optional[str] = None) -> Dict[str, Any]:
        """Get aggregation data for a specific tag across all holdings"""
        match_stage = {"user_id": user_id, f"tags.{tag_name}": {"$exists": True}}
        if portfolio_id:
            match_stage["portfolio_id"] = portfolio_id
        
        pipeline = [
            {"$match": match_stage},
            {"$project": {
                "symbol": 1,
                "tag_value": f"$tags.{tag_name}"
            }}
        ]
        
        cursor = self.holding_tags_collection.aggregate(pipeline)
        results = []
        
        async for doc in cursor:
            results.append({
                "symbol": doc["symbol"],
                "tag_value": doc["tag_value"]
            })
        
        return {"tag_name": tag_name, "holdings": results}

    async def _validate_tag_value(self, tag_value: TagValue, tag_def: TagDefinition) -> None:
        """Validate a tag value against its definition"""
        if tag_value.tag_type != tag_def.tag_type:
            raise ValueError(f"Tag type mismatch: expected {tag_def.tag_type}, got {tag_value.tag_type}")
        
        if tag_def.tag_type == TagType.ENUM:
            if tag_value.enum_value not in tag_def.enum_values:
                raise ValueError(f"Invalid enum value: {tag_value.enum_value} not in {tag_def.enum_values}")
        
        elif tag_def.tag_type == TagType.SCALAR:
            if tag_def.scalar_data_type in [ScalarDataType.FLOAT, ScalarDataType.INTEGER, ScalarDataType.PERCENTAGE]:
                if not isinstance(tag_value.scalar_value, (int, float)):
                    raise ValueError(f"Expected numeric value for {tag_def.scalar_data_type}")
                
                if tag_def.min_value is not None and tag_value.scalar_value < tag_def.min_value:
                    raise ValueError(f"Value {tag_value.scalar_value} below minimum {tag_def.min_value}")
                
                if tag_def.max_value is not None and tag_value.scalar_value > tag_def.max_value:
                    raise ValueError(f"Value {tag_value.scalar_value} above maximum {tag_def.max_value}")
        
        elif tag_def.tag_type == TagType.MAP:
            if tag_def.allowed_keys and tag_value.map_value:
                invalid_keys = set(tag_value.map_value.keys()) - set(tag_def.allowed_keys)
                if invalid_keys:
                    raise ValueError(f"Invalid map keys: {invalid_keys} not in allowed keys {tag_def.allowed_keys}")
        
        elif tag_def.tag_type == TagType.HIERARCHICAL:
            if tag_def.max_depth and tag_value.hierarchical_value:
                if len(tag_value.hierarchical_value) > tag_def.max_depth:
                    raise ValueError(f"Hierarchical depth {len(tag_value.hierarchical_value)} exceeds maximum {tag_def.max_depth}")

    async def adopt_template_tag(self, user_id: str, template_tag_name: str, custom_name: Optional[str] = None) -> TagDefinition:
        """Adopt a template tag as a custom tag definition"""
        if template_tag_name not in DEFAULT_TAG_TEMPLATES:
            raise ValueError(f"Template tag '{template_tag_name}' not found")
        
        template = DEFAULT_TAG_TEMPLATES[template_tag_name]
        
        # Create a copy with user ownership
        custom_tag = TagDefinition(
            name=custom_name or template_tag_name,
            display_name=template.display_name,
            description=template.description,
            tag_type=template.tag_type,
            enum_values=template.enum_values,
            scalar_data_type=template.scalar_data_type,
            min_value=template.min_value,
            max_value=template.max_value,
            map_key_type=template.map_key_type,
            allowed_keys=template.allowed_keys,
            max_depth=template.max_depth,
            path_separator=template.path_separator,
            time_format=template.time_format,
            relationship_type=template.relationship_type,
            user_id=user_id
        )
        
        return await self.add_tag_definition(user_id, custom_tag) 