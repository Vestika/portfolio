from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.auth import get_current_user
from services.real_estate.pricing import get_real_estate_service

router = APIRouter()


class EstimateQuery(BaseModel):
	q: str
	rooms: Optional[int] = None
	type: str = "sell"  # sell | rent
	sqm: Optional[int] = None  # reserved for future heuristics


class LocationSearchResult(BaseModel):
	type: str  # "city", "neighborhood", "street"
	name: str
	display_name: str
	city: str
	neighborhood: Optional[str] = None
	street: Optional[str] = None
	median_price: Optional[int] = None
	total_deals: Optional[int] = None
	date_range: Optional[str] = None


class LocationSearchResponse(BaseModel):
	results: List[LocationSearchResult]
	pagination: Dict[str, Any]
	summary: Optional[Dict[str, Any]] = None


@router.get("/api/real-estate/autocomplete")
async def real_estate_autocomplete(user=Depends(get_current_user)) -> Dict[str, Any]:
	"""Legacy autocomplete endpoint - returns static city/neighborhood lists."""
	service = get_real_estate_service()
	try:
		lists = await service.fetch_autocomplete()
		return {"cities": lists.get("cities", []), "cities_and_neighborhoods": lists.get("cities_and_neighborhoods", [])}
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"Autocomplete error: {e}")


@router.get("/api/real-estate/search")
async def real_estate_search(
	q: str = Query(..., description="Search query (Hebrew or English)"),
	page: int = Query(1, ge=1, description="Page number"),
	per_page: int = Query(10, ge=1, le=50, description="Results per page"),
	min_deals: Optional[int] = Query(None, ge=0, description="Minimum number of deals filter"),
	location_type: str = Query("all", pattern="^(all|city|neighborhood|street)$", description="Filter by location type"),
	user=Depends(get_current_user),
) -> Dict[str, Any]:
	"""
	Dynamic location search with real-time market data.

	Returns cities, neighborhoods, and streets matching the query,
	along with median prices and transaction counts for each result.

	More granular than the static autocomplete - supports street-level search.
	"""
	service = get_real_estate_service()
	if not q or not q.strip():
		raise HTTPException(status_code=400, detail="Missing search query")

	try:
		result = await service.search_locations(
			query=q.strip(),
			page=page,
			per_page=per_page,
			min_deals=min_deals,
			location_type=location_type,
		)
		return result
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"Search error: {e}")


@router.get("/api/real-estate/estimate")
async def real_estate_estimate(
	q: str = Query(..., description="City or neighborhood"),
	rooms: Optional[int] = Query(None),
	type: str = Query("sell", pattern="^(sell|rent)$"),
	sqm: Optional[int] = Query(None),
	user=Depends(get_current_user),
) -> Dict[str, Any]:
	"""Legacy estimate endpoint using city/neighborhood query string."""
	service = get_real_estate_service()
	if not q or not q.strip():
		raise HTTPException(status_code=400, detail="Missing query")
	try:
		if type == "sell":
			data = await service.fetch_sell_prices(q, rooms=rooms)
		else:
			data = await service.fetch_rent_prices(q, rooms=rooms)
		# For now we directly return the room-based price mapping from pynadlan.
		return {"query": q, "type": type, "rooms": rooms, "prices": data, "sqm": sqm}
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"Estimate error: {e}")


@router.get("/api/real-estate/estimate-v2")
async def real_estate_estimate_v2(
	location_type: str = Query(..., pattern="^(city|neighborhood|street)$", description="Location type from search"),
	city: str = Query(..., description="City name"),
	street: Optional[str] = Query(None, description="Street name (required for street type)"),
	neighborhood: Optional[str] = Query(None, description="Neighborhood name"),
	rooms: Optional[int] = Query(None, ge=1, le=10, description="Number of rooms"),
	sqm: Optional[int] = Query(None, ge=1, description="Square meters"),
	user=Depends(get_current_user),
) -> Dict[str, Any]:
	"""
	Enhanced estimate endpoint that works with search results.

	For streets: Returns transaction-based pricing with price per sqm
	For cities/neighborhoods: Returns room-based median prices
	"""
	service = get_real_estate_service()

	if location_type == "street" and not street:
		raise HTTPException(status_code=400, detail="Street name required for street location type")

	try:
		result = await service.fetch_prices_for_location(
			location_type=location_type,
			city=city,
			street=street,
			neighborhood=neighborhood,
			rooms=rooms,
			sqm=sqm,
		)
		return result
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"Estimate error: {e}")


