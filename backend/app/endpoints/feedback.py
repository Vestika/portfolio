"""Feedback endpoint: saves to Mongo and sends to Telegram"""
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.asynchronous.database import AsyncDatabase

from core.auth import get_current_user
from core.database import get_db
from models.feedback import Feedback
from services.telegram.service import get_telegram_service


router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    nps_score: Optional[int] = Field(default=None, ge=0, le=10)
    category: Optional[str] = Field(default=None, max_length=100)
    page_url: Optional[str] = Field(default=None, max_length=500)
    contact_email: Optional[str] = Field(default=None, max_length=320)


@router.post("")
async def submit_feedback(
    payload: FeedbackRequest,
    request: Request,
    db: AsyncDatabase = Depends(get_db),
    user = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        # Build feedback model
        feedback = Feedback(
            message=payload.message,
            nps_score=payload.nps_score,
            category=payload.category,
            page_url=payload.page_url,
            contact_email=payload.contact_email.strip() if payload.contact_email else None,
            user_id=getattr(user, "firebase_uid", None),
            user_email=getattr(user, "email", None),
            user_name=getattr(user, "name", None),
            created_at=datetime.utcnow(),
        )

        # Persist to Mongo
        collection = db["feedback"]
        insert_result = await collection.insert_one(feedback.to_document())

        # Send to Telegram (best-effort)
        telegram_service = get_telegram_service()
        doc_for_telegram = {
            "message": feedback.message,
            "nps_score": feedback.nps_score,
            "category": feedback.category,
            "page_url": feedback.page_url,
            "contact_email": feedback.contact_email,
            "user": {
                "uid": getattr(user, "firebase_uid", None),
                "email": getattr(user, "email", None),
                "name": getattr(user, "name", None),
            },
        }
        await telegram_service.send_feedback(doc_for_telegram)

        return {"ok": True, "feedback_id": str(insert_result.inserted_id)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {exc}")


