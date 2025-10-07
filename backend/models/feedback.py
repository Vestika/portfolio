from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class Feedback(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    nps_score: Optional[int] = Field(default=None, ge=0, le=10)
    category: Optional[str] = Field(default=None, max_length=100)
    page_url: Optional[str] = Field(default=None, max_length=500)
    contact_email: Optional[str] = Field(default=None, max_length=320)

    # Captured user context (optional if anonymous)
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    def to_document(self) -> Dict[str, Any]:
        d = self.dict()
        return d


