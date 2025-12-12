"""Tax Planner endpoints for tax planning scenarios"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from core.auth import get_current_user
from core.database import db_manager

# Create router for this module
router = APIRouter(prefix="/tax-planner", tags=["tax-planner"])

COLLECTION_NAME = "tax_scenarios"


# Request/Response models
class TaxEntryModel(BaseModel):
    """Single tax entry within a scenario"""
    id: str
    symbol: str
    security_name: Optional[str] = None
    portfolio_id: Optional[str] = None
    account_name: Optional[str] = None
    units: float
    cost_basis_per_unit: float
    sell_price_per_unit: float
    sell_date: Optional[str] = None
    currency: str = "USD"
    notes: Optional[str] = None


class CreateTaxScenarioRequest(BaseModel):
    """Request to create a new scenario"""
    name: str
    description: Optional[str] = None
    year: Optional[int] = None
    entries: List[TaxEntryModel] = []
    base_currency: str = "USD"


class UpdateTaxScenarioRequest(BaseModel):
    """Request to update an existing scenario"""
    name: Optional[str] = None
    description: Optional[str] = None
    year: Optional[int] = None
    entries: Optional[List[TaxEntryModel]] = None
    base_currency: Optional[str] = None


class TaxScenarioResponse(BaseModel):
    """Response for a single scenario"""
    scenario_id: str
    name: str
    description: Optional[str] = None
    year: Optional[int] = None
    entries: List[TaxEntryModel]
    base_currency: str
    created_at: str
    updated_at: str


@router.get("/scenarios", response_model=List[TaxScenarioResponse])
async def get_scenarios(
    year: Optional[int] = None,
    user=Depends(get_current_user)
) -> List[TaxScenarioResponse]:
    """Get all tax scenarios for the current user"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        query = {"user_id": user.id}
        if year:
            query["year"] = year

        scenarios = []
        async for doc in collection.find(query).sort("updated_at", -1):
            scenarios.append(TaxScenarioResponse(
                scenario_id=str(doc["_id"]),
                name=doc["name"],
                description=doc.get("description"),
                year=doc.get("year"),
                entries=[TaxEntryModel(**e) for e in doc.get("entries", [])],
                base_currency=doc.get("base_currency", "USD"),
                created_at=doc["created_at"].isoformat(),
                updated_at=doc["updated_at"].isoformat()
            ))

        return scenarios
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scenarios: {str(e)}")


@router.get("/scenarios/{scenario_id}", response_model=TaxScenarioResponse)
async def get_scenario(
    scenario_id: str,
    user=Depends(get_current_user)
) -> TaxScenarioResponse:
    """Get a specific scenario by ID"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        doc = await collection.find_one({
            "_id": ObjectId(scenario_id),
            "user_id": user.id
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Scenario not found")

        return TaxScenarioResponse(
            scenario_id=str(doc["_id"]),
            name=doc["name"],
            description=doc.get("description"),
            year=doc.get("year"),
            entries=[TaxEntryModel(**e) for e in doc.get("entries", [])],
            base_currency=doc.get("base_currency", "USD"),
            created_at=doc["created_at"].isoformat(),
            updated_at=doc["updated_at"].isoformat()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scenario: {str(e)}")


@router.post("/scenarios", response_model=TaxScenarioResponse)
async def create_scenario(
    request: CreateTaxScenarioRequest,
    user=Depends(get_current_user)
) -> TaxScenarioResponse:
    """Create a new tax scenario"""
    try:
        collection = db_manager.get_collection(COLLECTION_NAME)

        now = datetime.utcnow()
        doc = {
            "user_id": user.id,
            "name": request.name,
            "description": request.description,
            "year": request.year,
            "entries": [entry.model_dump() for entry in request.entries],
            "base_currency": request.base_currency,
            "created_at": now,
            "updated_at": now
        }

        result = await collection.insert_one(doc)

        return TaxScenarioResponse(
            scenario_id=str(result.inserted_id),
            name=request.name,
            description=request.description,
            year=request.year,
            entries=request.entries,
            base_currency=request.base_currency,
            created_at=now.isoformat(),
            updated_at=now.isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create scenario: {str(e)}")


@router.put("/scenarios/{scenario_id}", response_model=TaxScenarioResponse)
async def update_scenario(
    scenario_id: str,
    request: UpdateTaxScenarioRequest,
    user=Depends(get_current_user)
) -> TaxScenarioResponse:
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
        if request.description is not None:
            update_fields["description"] = request.description
        if request.year is not None:
            update_fields["year"] = request.year
        if request.entries is not None:
            update_fields["entries"] = [entry.model_dump() for entry in request.entries]
        if request.base_currency is not None:
            update_fields["base_currency"] = request.base_currency

        await collection.update_one(
            {"_id": ObjectId(scenario_id)},
            {"$set": update_fields}
        )

        # Return updated document
        updated = await collection.find_one({"_id": ObjectId(scenario_id)})

        return TaxScenarioResponse(
            scenario_id=str(updated["_id"]),
            name=updated["name"],
            description=updated.get("description"),
            year=updated.get("year"),
            entries=[TaxEntryModel(**e) for e in updated.get("entries", [])],
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

        return {"message": "Scenario deleted successfully", "scenario_id": scenario_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete scenario: {str(e)}")
