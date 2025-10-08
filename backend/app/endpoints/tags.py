"""Tag management endpoints"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import get_current_user
from core.database import db_manager
from core.tag_service import TagService
from models import User, TagDefinition, TagValue, DEFAULT_TAG_TEMPLATES

# Create router for this module
router = APIRouter()

async def get_tag_service() -> TagService:
    """Dependency to get tag service"""
    if db_manager.database is None:
        await db_manager.connect()
    return TagService(db_manager.database)

# Tag Library Management
@router.get("/tags/library")
async def get_user_tag_library(
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get user's tag library with all tag definitions"""
    user_id = current_user.firebase_uid
    library = await tag_service.get_user_tag_library(user_id)
    return library.dict()

@router.post("/tags/definitions")
async def create_tag_definition(
    tag_definition: TagDefinition,
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Create or update a tag definition"""
    user_id = current_user.firebase_uid
    result = await tag_service.add_tag_definition(user_id, tag_definition)
    return result.dict()

@router.delete("/tags/definitions/{tag_name}")
async def delete_tag_definition(
    tag_name: str,
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Delete a tag definition and all associated values and charts"""
    user_id = current_user.firebase_uid
    success = await tag_service.delete_tag_definition(user_id, tag_name)
    if not success:
        raise HTTPException(status_code=404, detail="Tag definition not found")
    
    # Also delete any custom charts associated with this tag
    try:
        custom_charts_collection = db_manager.get_collection("custom_charts")
        delete_result = await custom_charts_collection.delete_many({
            "user_id": user_id,
            "tag_name": tag_name
        })
        if delete_result.deleted_count > 0:
            print(f"🗑️ [TAG DELETE] Deleted {delete_result.deleted_count} custom charts for tag '{tag_name}'")
    except Exception as e:
        print(f"⚠️ [TAG DELETE] Failed to delete custom charts for tag '{tag_name}': {e}")
        # Don't fail the tag deletion if chart cleanup fails
    
    return {"message": f"Tag definition '{tag_name}' deleted successfully"}

@router.post("/tags/adopt-template/{template_name}")
async def adopt_template_tag(
    template_name: str,
    custom_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Adopt a template tag as a custom tag definition"""
    user_id = current_user.firebase_uid
    try:
        result = await tag_service.adopt_template_tag(user_id, template_name, custom_name)
        return result.dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Holding Tags Management
@router.get("/holdings/{symbol}/tags")
async def get_holding_tags(
    symbol: str,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get all tags for a specific holding"""
    user_id = current_user.firebase_uid
    holding_tags = await tag_service.get_holding_tags(user_id, symbol, portfolio_id)
    return holding_tags.dict()

@router.put("/holdings/{symbol}/tags/{tag_name}")
async def set_holding_tag(
    symbol: str,
    tag_name: str,
    tag_value: TagValue,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Set a tag value for a holding"""
    user_id = current_user.firebase_uid
    try:
        result = await tag_service.set_holding_tag(user_id, symbol, tag_name, tag_value, portfolio_id)
        return result.dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/holdings/{symbol}/tags/{tag_name}")
async def remove_holding_tag(
    symbol: str,
    tag_name: str,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Remove a tag from a holding"""
    user_id = current_user.firebase_uid
    success = await tag_service.remove_holding_tag(user_id, symbol, tag_name, portfolio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found for this holding")
    return {"message": f"Tag '{tag_name}' removed from {symbol}"}

@router.get("/holdings/tags")
async def get_all_holding_tags(
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get tags for all holdings"""
    user_id = current_user.firebase_uid
    all_tags = await tag_service.get_all_holding_tags(user_id, portfolio_id)
    return [tags.dict() for tags in all_tags]

# Tag Search and Aggregation
@router.get("/holdings/search")
async def search_holdings_by_tags(
    tag_filters: str = Query(..., description="JSON string of tag filters"),
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Search holdings by tag criteria"""
    import json
    user_id = current_user.firebase_uid

    try:
        filters = json.loads(tag_filters)
        symbols = await tag_service.search_holdings_by_tags(user_id, filters, portfolio_id)
        return {"symbols": symbols, "filters_used": filters}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in tag_filters parameter")

@router.get("/tags/{tag_name}/aggregation")
async def get_tag_aggregation(
    tag_name: str,
    portfolio_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tag_service: TagService = Depends(get_tag_service)
):
    """Get aggregation data for a specific tag across all holdings"""
    user_id = current_user.firebase_uid
    aggregation = await tag_service.get_tag_aggregations(user_id, tag_name, portfolio_id)
    return aggregation

# Template Tags
@router.get("/tags/templates")
async def get_template_tags():
    """Get all available template tags"""
    return {
        "templates": {name: template.dict() for name, template in DEFAULT_TAG_TEMPLATES.items()}
    }