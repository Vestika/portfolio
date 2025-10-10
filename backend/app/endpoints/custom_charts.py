"""Custom charts endpoints for user-created charts"""
from typing import Any, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from core.auth import get_current_user
from core.database import db_manager

# Create router for this module
router = APIRouter(prefix="/user/custom-charts", tags=["custom-charts"])

# Request/Response models
class CreateCustomChartRequest(BaseModel):
    chart_title: str
    tag_name: str
    portfolio_id: Optional[str] = None
    # Note: chart_data and chart_total are calculated dynamically in frontend, not stored

class CustomChartResponse(BaseModel):
    chart_id: str
    chart_title: str
    tag_name: str
    portfolio_id: Optional[str] = None
    created_at: str
    updated_at: str

@router.post("", response_model=CustomChartResponse)
async def create_custom_chart(
    request: CreateCustomChartRequest,
    user=Depends(get_current_user)
) -> CustomChartResponse:
    """Create a new custom chart definition (data calculated dynamically in frontend)"""
    try:
        collection = db_manager.get_collection("custom_charts")
        
        # Create chart document - only store definition, not data
        chart_doc = {
            "user_id": user.id,
            "chart_title": request.chart_title,
            "tag_name": request.tag_name,
            "portfolio_id": request.portfolio_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await collection.insert_one(chart_doc)
        
        return CustomChartResponse(
            chart_id=str(result.inserted_id),
            chart_title=request.chart_title,
            tag_name=request.tag_name,
            portfolio_id=request.portfolio_id,
            created_at=chart_doc["created_at"].isoformat(),
            updated_at=chart_doc["updated_at"].isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create custom chart: {str(e)}")


@router.get("", response_model=List[CustomChartResponse])
async def get_custom_charts(
    portfolio_id: Optional[str] = None,
    user=Depends(get_current_user)
) -> List[CustomChartResponse]:
    """Get all custom chart definitions for the current user (data calculated dynamically)"""
    try:
        collection = db_manager.get_collection("custom_charts")
        
        # Build query
        query = {"user_id": user.id}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id
        
        charts = []
        async for doc in collection.find(query).sort("created_at", -1):
            charts.append(CustomChartResponse(
                chart_id=str(doc["_id"]),
                chart_title=doc["chart_title"],
                tag_name=doc["tag_name"],
                portfolio_id=doc.get("portfolio_id"),
                created_at=doc["created_at"].isoformat(),
                updated_at=doc["updated_at"].isoformat()
            ))
        
        return charts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve custom charts: {str(e)}")


@router.delete("/{chart_id}")
async def delete_custom_chart(
    chart_id: str,
    user=Depends(get_current_user)
) -> dict:
    """Delete a custom chart"""
    try:
        collection = db_manager.get_collection("custom_charts")
        
        # Verify ownership
        chart = await collection.find_one({"_id": ObjectId(chart_id), "user_id": user.id})
        if not chart:
            raise HTTPException(status_code=404, detail="Chart not found")
        
        # Delete the chart
        await collection.delete_one({"_id": ObjectId(chart_id)})
        
        return {"message": "Chart deleted successfully", "chart_id": chart_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete custom chart: {str(e)}")

