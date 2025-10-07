from typing import Any, Dict, Optional
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


@router.get("/api/real-estate/autocomplete")
async def real_estate_autocomplete(user=Depends(get_current_user)) -> Dict[str, Any]:
	service = get_real_estate_service()
	try:
		lists = await service.fetch_autocomplete()
		return {"cities": lists.get("cities", []), "cities_and_neighborhoods": lists.get("cities_and_neighborhoods", [])}
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"Autocomplete error: {e}")


@router.get("/api/real-estate/estimate")
async def real_estate_estimate(
	q: str = Query(..., description="City or neighborhood"),
	rooms: Optional[int] = Query(None),
	type: str = Query("sell", pattern="^(sell|rent)$"),
	sqm: Optional[int] = Query(None),
	user=Depends(get_current_user),
) -> Dict[str, Any]:
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


