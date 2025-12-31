"""Cash Flow endpoints for cash flow scenario management"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from core.auth import get_current_user
from core.database import db_manager
from core.analytics import get_analytics_service
from core.analytics_events import (
    EVENT_CASH_FLOW_SCENARIO_CREATED,
    EVENT_CASH_FLOW_SCENARIO_DELETED,
    build_cash_flow_properties
)

# Create router for this module
router = APIRouter(prefix="/cash-flow", tags=["cash-flow"])

COLLECTION_NAME = "cash_flow_scenarios"


# Request/Response models
class CashFlowItemModel(BaseModel):
    """Single cash flow item within a scenario"""
    id: str
    name: str
    type: str  # 'inflow' | 'outflow' | 'transfer'
    amount: float
    currency: str = "ILS"  # 'USD' | 'ILS'
    percentage: Optional[float] = None
    frequency: str  # 'weekly' | 'bi-weekly' | 'monthly' | 'yearly'
    source_account_id: Optional[str] = None
    category_id: Optional[str] = None
    destination_account_id: Optional[str] = None
    is_active: bool = True
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None


class CashFlowCategoryModel(BaseModel):
    """Category definition"""
    id: str
    name: str
    type: str  # 'inflow' | 'outflow' | 'transfer'
    icon: Optional[str] = None
    is_custom: bool = False


class CreateCashFlowScenarioRequest(BaseModel):
    """Request to create a new scenario"""
    portfolio_id: str
    name: str
    items: List[CashFlowItemModel] = []
    categories: List[CashFlowCategoryModel] = []
    base_currency: str = "ILS"


class UpdateCashFlowScenarioRequest(BaseModel):
    """Request to update an existing scenario"""
    name: Optional[str] = None
    items: Optional[List[CashFlowItemModel]] = None
    categories: Optional[List[CashFlowCategoryModel]] = None
    base_currency: Optional[str] = None


class CashFlowScenarioResponse(BaseModel):
    """Response for a single scenario"""
    scenario_id: str
    portfolio_id: str
    name: str
    items: List[CashFlowItemModel]
    categories: List[CashFlowCategoryModel]
    base_currency: str
    created_at: str
    updated_at: str


@router.get("/scenarios", response_model=List[CashFlowScenarioResponse])
async def get_scenarios(
    portfolio_id: Optional[str] = None,
    user=Depends(get_current_user)
) -> List[CashFlowScenarioResponse]:
    """Get all cash flow scenarios for the current user, optionally filtered by portfolio"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        query = {"user_id": user.id}
        if portfolio_id:
            query["portfolio_id"] = portfolio_id

        scenarios = []
        async for doc in collection.find(query).sort("updated_at", -1):
            scenarios.append(CashFlowScenarioResponse(
                scenario_id=str(doc["_id"]),
                portfolio_id=doc["portfolio_id"],
                name=doc["name"],
                items=[CashFlowItemModel(**item) for item in doc.get("items", [])],
                categories=[CashFlowCategoryModel(**cat) for cat in doc.get("categories", [])],
                base_currency=doc.get("base_currency", "USD"),
                created_at=doc["created_at"].isoformat(),
                updated_at=doc["updated_at"].isoformat()
            ))

        return scenarios
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scenarios: {str(e)}")


@router.get("/scenarios/{scenario_id}", response_model=CashFlowScenarioResponse)
async def get_scenario(
    scenario_id: str,
    user=Depends(get_current_user)
) -> CashFlowScenarioResponse:
    """Get a specific scenario by ID"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        doc = await collection.find_one({
            "_id": ObjectId(scenario_id),
            "user_id": user.id
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Scenario not found")

        return CashFlowScenarioResponse(
            scenario_id=str(doc["_id"]),
            portfolio_id=doc["portfolio_id"],
            name=doc["name"],
            items=[CashFlowItemModel(**item) for item in doc.get("items", [])],
            categories=[CashFlowCategoryModel(**cat) for cat in doc.get("categories", [])],
            base_currency=doc.get("base_currency", "USD"),
            created_at=doc["created_at"].isoformat(),
            updated_at=doc["updated_at"].isoformat()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scenario: {str(e)}")


@router.post("/scenarios", response_model=CashFlowScenarioResponse)
async def create_scenario(
    request: CreateCashFlowScenarioRequest,
    user=Depends(get_current_user)
) -> CashFlowScenarioResponse:
    """Create a new cash flow scenario"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        now = datetime.utcnow()
        doc = {
            "user_id": user.id,
            "portfolio_id": request.portfolio_id,
            "name": request.name,
            "items": [item.model_dump() for item in request.items],
            "categories": [cat.model_dump() for cat in request.categories],
            "base_currency": request.base_currency,
            "created_at": now,
            "updated_at": now
        }

        result = await collection.insert_one(doc)

        scenario_id = str(result.inserted_id)

        # Track cash flow scenario creation
        analytics = get_analytics_service()
        analytics.track_event(
            user=user,
            event_name=EVENT_CASH_FLOW_SCENARIO_CREATED,
            properties=build_cash_flow_properties(
                scenario_id=scenario_id,
                scenario_name=request.name,
                portfolio_id=request.portfolio_id,
                items_count=len(request.items),
                categories_count=len(request.categories)
            )
        )

        return CashFlowScenarioResponse(
            scenario_id=scenario_id,
            portfolio_id=request.portfolio_id,
            name=request.name,
            items=request.items,
            categories=request.categories,
            base_currency=request.base_currency,
            created_at=now.isoformat(),
            updated_at=now.isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create scenario: {str(e)}")


@router.put("/scenarios/{scenario_id}", response_model=CashFlowScenarioResponse)
async def update_scenario(
    scenario_id: str,
    request: UpdateCashFlowScenarioRequest,
    user=Depends(get_current_user)
) -> CashFlowScenarioResponse:
    """Update an existing scenario"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        # Verify ownership
        existing = await collection.find_one({
            "_id": ObjectId(scenario_id),
            "user_id": user.id
        })

        if not existing:
            raise HTTPException(status_code=404, detail="Scenario not found")

        # Build update
        update_fields = {"updated_at": datetime.utcnow()}
        if request.name is not None:
            update_fields["name"] = request.name
        if request.items is not None:
            update_fields["items"] = [item.model_dump() for item in request.items]
        if request.categories is not None:
            update_fields["categories"] = [cat.model_dump() for cat in request.categories]
        if request.base_currency is not None:
            update_fields["base_currency"] = request.base_currency

        await collection.update_one(
            {"_id": ObjectId(scenario_id)},
            {"$set": update_fields}
        )

        # Return updated document
        updated = await collection.find_one({"_id": ObjectId(scenario_id)})

        return CashFlowScenarioResponse(
            scenario_id=str(updated["_id"]),
            portfolio_id=updated["portfolio_id"],
            name=updated["name"],
            items=[CashFlowItemModel(**item) for item in updated.get("items", [])],
            categories=[CashFlowCategoryModel(**cat) for cat in updated.get("categories", [])],
            base_currency=updated.get("base_currency", "USD"),
            created_at=updated["created_at"].isoformat(),
            updated_at=updated["updated_at"].isoformat()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update scenario: {str(e)}")


@router.delete("/scenarios/{scenario_id}")
async def delete_scenario(
    scenario_id: str,
    user=Depends(get_current_user)
) -> dict:
    """Delete a scenario"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        # Verify ownership
        existing = await collection.find_one({
            "_id": ObjectId(scenario_id),
            "user_id": user.id
        })

        if not existing:
            raise HTTPException(status_code=404, detail="Scenario not found")

        await collection.delete_one({"_id": ObjectId(scenario_id)})

        # Track cash flow scenario deletion
        analytics = get_analytics_service()
        analytics.track_event(
            user=user,
            event_name=EVENT_CASH_FLOW_SCENARIO_DELETED,
            properties=build_cash_flow_properties(
                scenario_id=scenario_id,
                scenario_name=existing.get("name", "Unknown"),
                portfolio_id=existing.get("portfolio_id")
            )
        )

        return {"message": "Scenario deleted successfully", "scenario_id": scenario_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete scenario: {str(e)}")
