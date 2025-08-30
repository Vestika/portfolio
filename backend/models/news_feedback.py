from __future__ import annotations

from pydantic import BaseModel, Field


class NewsFeedback(BaseModel):
    user_id: str = Field(...)
    article_id: str = Field(...)
    action: str = Field(..., pattern="^(like|dislike)$")
    created_at: str = Field(...)


