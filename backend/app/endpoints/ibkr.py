"""Interactive Brokers (IBKR) integration endpoints"""
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import get_current_user
from services.interactive_brokers.service import IBFlexWebServiceClient

# Create router for this module
router = APIRouter()

# Request/Response models
class IBFlexPreviewRequest(BaseModel):
    access_token: str
    query_id: str

class IBFlexImportRequest(BaseModel):
    access_token: str
    query_id: str
    target_account_name: str
    owners: list[str] | None = None

@router.post("/ibkr/flex/preview")
async def ibkr_flex_preview_global(
    request: IBFlexPreviewRequest,
    user=Depends(get_current_user)
) -> dict[str, Any]:
    """
    Global preview endpoint: generate and retrieve a Flex statement (XML), parse OpenPositions and
    return aggregated holdings by symbol. No portfolio context required; nothing is persisted.
    """
    try:
        async with IBFlexWebServiceClient() as client:
            xml_text = await client.fetch_statement(request.access_token, request.query_id)
            holdings = client.parse_holdings_from_flex(xml_text)
            return {
                "success": True,
                "symbols_count": len(holdings),
                "holdings": holdings
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flex preview failed: {str(e)}")