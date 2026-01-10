"""User and authentication endpoints"""
import logging
from typing import Any, Optional, List, Literal
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from core.auth import get_current_user
from core.database import db_manager, get_db
from pymongo.asynchronous.database import AsyncDatabase
from models.deletion_models import (
    DeleteAccountRequest,
    DeleteAccountResponse,
    DeletionPartialFailureException
)
can from models.user_preferences_model import (
    UpdateConsentRequest,
    ConsentStatusResponse,
    ConsentRecord
)
from core.user_deletion_service import UserDeletionService
from core.analytics import get_analytics_service
from services.telegram.service import get_telegram_service

logger = logging.getLogger(__name__)

# Create router for this module
router = APIRouter(tags=["user"])

# Request/Response models
class DefaultPortfolioRequest(BaseModel):
    portfolio_id: str

class ChartMarker(BaseModel):
    """Chart marker for events like user join date"""
    id: str
    date: str  # ISO date string
    label: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None  # Emoji or icon identifier

class ChartMarkersResponse(BaseModel):
    """Response containing list of chart markers"""
    markers: List[ChartMarker]

class MiniChartTimeframeRequest(BaseModel):
    """Request to set mini-chart timeframe preference"""
    timeframe: Literal['7d', '30d', '1y']

@router.get("/")
async def root(user=Depends(get_current_user)):
    """Root endpoint with service information"""
    return {
        "service": "Portfolio API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
        "user": user.email
    }

@router.get("/default-portfolio")
async def get_default_portfolio(user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Get the default portfolio for the authenticated user.
    """
    try:
        collection = db_manager.get_collection("user_preferences")
        preferences = await collection.find_one({"user_id": user.id})
        
        if not preferences:
            return {"default_portfolio_id": None}
        
        return {
            "default_portfolio_id": preferences.get("default_portfolio_id")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/default-portfolio")
async def set_default_portfolio(request: DefaultPortfolioRequest, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Set the default portfolio for the authenticated user.
    """
    try:
        # Validate that the portfolio exists and belongs to the user
        portfolios_collection = db_manager.get_collection("portfolios")
        portfolio_exists = await portfolios_collection.find_one({"_id": ObjectId(request.portfolio_id), "user_id": user.id})
        if not portfolio_exists:
            raise HTTPException(status_code=404, detail=f"Portfolio {request.portfolio_id} not found")
        
        # Update or create user preferences
        preferences_collection = db_manager.get_collection("user_preferences")
        
        # Try to update existing preferences
        result = await preferences_collection.update_one(
            {"user_id": user.id},
            {
                "$set": {
                    "default_portfolio_id": request.portfolio_id,
                    "updated_at": datetime.now()
                }
            },
            upsert=True
        )
        
        return {
            "message": "Default portfolio set successfully",
            "portfolio_id": request.portfolio_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chart-markers", response_model=ChartMarkersResponse)
async def get_chart_markers(
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
) -> ChartMarkersResponse:
    """
    Get chart markers for the user (e.g., join date, milestones).
    Returns a list of markers that can be displayed on the portfolio value chart.
    """
    try:
        markers: List[ChartMarker] = []
        
        # Get user profile for join date
        profile_collection = db.user_profiles
        profile = await profile_collection.find_one({"user_id": user.id})
        
        if profile and profile.get("created_at"):
            created_at = profile["created_at"]
            # Handle both datetime object and string formats
            if isinstance(created_at, datetime):
                date_str = created_at.strftime("%Y-%m-%d")
            else:
                date_str = str(created_at)[:10]  # Extract YYYY-MM-DD from ISO string
            
            markers.append(ChartMarker(
                id="user_join",
                date=date_str,
                label="Joined Vestika",
                description=f"You joined Vestika on {date_str}",
                color="#22c55e",  # Green color
                icon="🎉"
            ))
        
        # Future: Add more markers here
        # - Portfolio creation dates
        # - Significant transactions
        # - Achievement milestones
        
        return ChartMarkersResponse(markers=markers)
        
    except Exception as e:
        print(f"🔍 [CHART MARKERS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mini-chart-timeframe")
async def get_mini_chart_timeframe(user=Depends(get_current_user)) -> dict[str, str]:
    """
    Get the user's preferred mini-chart timeframe for the holdings table.
    Default is '7d' if not set.
    """
    try:
        collection = db_manager.get_collection("user_preferences")
        preferences = await collection.find_one({"user_id": user.id})
        
        if not preferences:
            return {"timeframe": "7d"}  # Default
        
        return {
            "timeframe": preferences.get("mini_chart_timeframe", "7d")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mini-chart-timeframe")
async def set_mini_chart_timeframe(
    request: MiniChartTimeframeRequest,
    user=Depends(get_current_user)
) -> dict[str, str]:
    """
    Set the user's preferred mini-chart timeframe for the holdings table.
    Valid values: '7d', '30d', '1y'
    """
    try:
        preferences_collection = db_manager.get_collection("user_preferences")

        await preferences_collection.update_one(
            {"user_id": user.id},
            {
                "$set": {
                    "mini_chart_timeframe": request.timeframe,
                    "updated_at": datetime.now()
                }
            },
            upsert=True
        )

        return {
            "message": "Mini-chart timeframe preference saved successfully",
            "timeframe": request.timeframe
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Privacy & Consent Management - Israeli Privacy Law Amendment 13 Compliance
# ============================================================================

@router.get("/me/consent", response_model=ConsentStatusResponse)
async def get_consent_status(
    user=Depends(get_current_user)
) -> ConsentStatusResponse:
    """
    Get current consent status for the authenticated user.

    **Complies with Israeli Privacy Law Amendment 13 (Section 11 transparency requirements).**

    Returns user's current consent preferences for:
    - Analytics tracking (Mixpanel)
    - Marketing communications

    If no preferences exist, returns default (all declined).

    Returns:
        ConsentStatusResponse with current consent status and timestamps
    """
    try:
        preferences_collection = db_manager.get_collection("user_preferences")
        preferences = await preferences_collection.find_one({"user_id": user.id})

        if not preferences:
            # No preferences exist - return defaults (all declined)
            now = datetime.utcnow()
            return ConsentStatusResponse(
                analytics_consent=False,
                analytics_consent_date=None,
                marketing_consent=False,
                marketing_consent_date=None
            )

        # Extract consent records
        analytics_consent = preferences.get("analytics_consent", {})
        marketing_consent = preferences.get("marketing_consent", {})

        return ConsentStatusResponse(
            analytics_consent=analytics_consent.get("granted", False),
            analytics_consent_date=analytics_consent.get("timestamp"),
            marketing_consent=marketing_consent.get("granted", False),
            marketing_consent_date=marketing_consent.get("timestamp")
        )

    except Exception as e:
        logger.error(f"Error fetching consent status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/me/consent", response_model=ConsentStatusResponse)
async def update_consent(
    request: UpdateConsentRequest,
    user=Depends(get_current_user)
) -> ConsentStatusResponse:
    """
    Update consent preferences for the authenticated user.

    **Complies with Israeli Privacy Law Amendment 13 (Section 8 - lawful processing).**

    Users can grant or revoke consent for:
    - Analytics tracking (Mixpanel) - affects data collection
    - Marketing communications - affects promotional emails

    **Privacy Note**: Financial data (symbols, prices, account names) is NEVER
    sent to analytics, regardless of consent status. Only usage events are tracked.

    **Audit Trail**: All consent changes are timestamped and stored for compliance.

    Args:
        request: UpdateConsentRequest with consent preferences
        user: Current authenticated user

    Returns:
        ConsentStatusResponse with updated consent status

    Raises:
        HTTPException: 500 if update fails
    """
    try:
        preferences_collection = db_manager.get_collection("user_preferences")
        now = datetime.utcnow()

        # Build update document
        update_doc = {"updated_at": now}

        if request.analytics_consent is not None:
            update_doc["analytics_consent"] = {
                "granted": request.analytics_consent,
                "timestamp": now,
                # Note: IP address and user agent could be added here for full audit trail
                # "ip_address": request.client.host,
                # "user_agent": request.headers.get("user-agent")
            }

            # Track consent change in analytics (if user is granting consent)
            if request.analytics_consent:
                try:
                    analytics = get_analytics_service()
                    analytics.track_event(
                        user=user,
                        event_name="consent_granted_analytics",
                        properties={"timestamp": now.isoformat()}
                    )
                except Exception as e:
                    logger.warning(f"Failed to track consent grant: {e}")

        if request.marketing_consent is not None:
            update_doc["marketing_consent"] = {
                "granted": request.marketing_consent,
                "timestamp": now
            }

        # Update or create preferences with consent records
        result = await preferences_collection.update_one(
            {"user_id": user.id},
            {"$set": update_doc},
            upsert=True
        )

        logger.info(
            f"Consent updated for user {user.id}: "
            f"analytics={request.analytics_consent}, "
            f"marketing={request.marketing_consent}"
        )

        # Return current consent status
        return await get_consent_status(user=user)

    except Exception as e:
        logger.error(f"Error updating consent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Account Deletion - Israeli Privacy Law Amendment 13 Compliance
# ============================================================================

@router.post("/me/delete-account", response_model=DeleteAccountResponse)
async def delete_user_account(
    request: DeleteAccountRequest,
    user=Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db)
) -> DeleteAccountResponse:
    """
    Permanently delete user account and all associated data.

    **Complies with Israeli Privacy Law Amendment 13 ("right to be forgotten").**

    This operation:
    - Deletes all user data from MongoDB (15+ collections)
    - Removes user from Firebase Authentication
    - Cleans up external services (Mixpanel, Redis)
    - Creates immutable audit log
    - Cannot be undone

    **Data deleted:**
    - Portfolios, accounts, and holdings
    - Tags and custom charts
    - Chat history and notifications
    - User profile and preferences
    - All other user-specific data

    Args:
        request: Must contain confirmation="DELETE"
        user: Current authenticated user
        db: Database connection

    Returns:
        DeleteAccountResponse with success status and audit_id

    Raises:
        HTTPException: 400 if confirmation invalid, 500 if deletion fails
    """
    # Validate confirmation text
    if request.confirmation != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Confirmation text must be exactly 'DELETE'"
        )

    # Track deletion event BEFORE user is deleted from Mixpanel
    try:
        analytics = get_analytics_service()
        analytics.track_event(
            user=user,
            event_name="account_deleted_initiated",
            properties={}
        )
    except Exception as e:
        logger.warning(f"Failed to track account deletion event: {e}")

    # Perform deletion
    try:
        deletion_service = UserDeletionService(db)
        result = await deletion_service.delete_user_account(user)

        return DeleteAccountResponse(
            success=True,
            audit_id=result.audit_id,
            message="Your account has been permanently deleted"
        )

    except DeletionPartialFailureException as e:
        # Some data was deleted but some operations failed
        logger.error(f"Partial deletion failure: {e}")

        raise HTTPException(
            status_code=500,
            detail={
                "message": e.message,
                "audit_id": e.audit_id,
                "failed_collections": e.failed_collections,
                "partial_failure": True
            }
        )

    except Exception as e:
        logger.error(f"Account deletion failed: {e}", exc_info=True)

        raise HTTPException(
            status_code=500,
            detail="Failed to delete account. Please contact support."
        )