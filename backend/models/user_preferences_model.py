"""User preferences and consent model for privacy compliance"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ConsentRecord(BaseModel):
    """Record of user consent for a specific purpose"""
    granted: bool = Field(..., description="Whether consent was granted")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When consent was granted/revoked")
    ip_address: Optional[str] = Field(None, description="IP address at time of consent (for audit)")
    user_agent: Optional[str] = Field(None, description="User agent at time of consent (for audit)")


class UserPreferences(BaseModel):
    """User preferences including privacy consents (Amendment 13 compliance)"""
    user_id: str = Field(..., description="Firebase UID of the user")

    # Portfolio Preferences
    default_portfolio_id: Optional[str] = Field(None, description="Default portfolio to show on login")
    mini_chart_timeframe: Optional[str] = Field("30d", description="Preferred timeframe for mini charts (7d, 30d, 1y)")

    # Privacy & Consent (Amendment 13 Section 11 compliance)
    analytics_consent: ConsentRecord = Field(
        default_factory=lambda: ConsentRecord(granted=False, timestamp=datetime.utcnow()),
        description="Consent for analytics tracking (Mixpanel)"
    )
    marketing_consent: ConsentRecord = Field(
        default_factory=lambda: ConsentRecord(granted=False, timestamp=datetime.utcnow()),
        description="Consent for marketing communications"
    )

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "firebase_uid_123",
                "default_portfolio_id": "60d5ec49f1b2c8b3c8e4e6a1",
                "mini_chart_timeframe": "30d",
                "analytics_consent": {
                    "granted": True,
                    "timestamp": "2026-01-10T10:30:00Z",
                    "ip_address": "192.168.1.1",
                    "user_agent": "Mozilla/5.0..."
                },
                "marketing_consent": {
                    "granted": False,
                    "timestamp": "2026-01-10T10:30:00Z"
                }
            }
        }


class UpdateConsentRequest(BaseModel):
    """Request to update consent preferences"""
    analytics_consent: Optional[bool] = Field(None, description="Grant or revoke analytics consent")
    marketing_consent: Optional[bool] = Field(None, description="Grant or revoke marketing consent")

    class Config:
        json_schema_extra = {
            "example": {
                "analytics_consent": True,
                "marketing_consent": False
            }
        }


class ConsentStatusResponse(BaseModel):
    """Response containing current consent status"""
    analytics_consent: bool = Field(..., description="Current analytics consent status")
    analytics_consent_date: Optional[datetime] = Field(None, description="When analytics consent was last updated")
    marketing_consent: bool = Field(..., description="Current marketing consent status")
    marketing_consent_date: Optional[datetime] = Field(None, description="When marketing consent was last updated")

    class Config:
        json_schema_extra = {
            "example": {
                "analytics_consent": True,
                "analytics_consent_date": "2026-01-10T10:30:00Z",
                "marketing_consent": False,
                "marketing_consent_date": "2026-01-10T10:30:00Z"
            }
        }
