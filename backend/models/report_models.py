"""
Pydantic models for the Report Subscription System.

This module defines the data models for:
- Report subscriptions (user preferences)
- Report history (tracking sent reports)
- API request/response models
"""

from .base_model import BaseFeatureModel
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class ReportFrequency(str, Enum):
    """How often reports are generated and sent"""
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class ReportFormat(str, Enum):
    """Output format for reports"""
    PDF = "pdf"
    HTML = "html"


class ReportStatus(str, Enum):
    """Status of a report generation/delivery"""
    PENDING = "pending"
    GENERATING = "generating"
    SENT = "sent"
    FAILED = "failed"


class ReportSections(BaseModel):
    """Configuration for which sections to include in the report"""
    portfolio_summary: bool = Field(default=True, description="Total value and change summary")
    asset_allocation: bool = Field(default=True, description="Pie chart by security type")
    holdings_table: bool = Field(default=True, description="Top holdings table")
    performance_chart: bool = Field(default=False, description="Historical value chart")
    sector_breakdown: bool = Field(default=False, description="Distribution by sector")
    geographical_breakdown: bool = Field(default=False, description="Distribution by geography")
    concentration_analysis: bool = Field(default=False, description="Risk concentration metrics")
    options_vesting: bool = Field(default=False, description="Upcoming RSU/options events")
    ai_insights: bool = Field(default=False, description="AI-generated analysis summary")


class ReportSubscription(BaseFeatureModel):
    """
    User subscription for periodic portfolio reports.

    Users can configure:
    - Which email to send reports to
    - How often (weekly/monthly/quarterly)
    - Which portfolios to include
    - Which sections to include
    """
    user_id: str = Field(..., description="Firebase UID of the subscriber")

    # Email configuration
    email_address: str = Field(..., description="Email address to send reports to")
    email_verified: bool = Field(default=False, description="Whether email has been verified")
    email_verification_token: Optional[str] = Field(default=None, description="Token for email verification")
    email_verified_at: Optional[datetime] = Field(default=None, description="When email was verified")

    # Schedule configuration
    frequency: ReportFrequency = Field(default=ReportFrequency.MONTHLY, description="How often to send reports")
    preferred_day: int = Field(
        default=1,
        ge=0,
        le=31,
        description="Day for report: 0-6 for weekly (Mon-Sun), 1-31 for monthly/quarterly"
    )
    preferred_time_utc: str = Field(
        default="09:00",
        pattern=r"^\d{2}:\d{2}$",
        description="Time in UTC (HH:MM format)"
    )
    timezone: str = Field(default="UTC", description="User's timezone for display")

    # Portfolio selection
    portfolio_ids: List[str] = Field(
        default_factory=list,
        description="Specific portfolio IDs to include (empty = use include_all_portfolios)"
    )
    include_all_portfolios: bool = Field(
        default=True,
        description="If true, include all user's portfolios in report"
    )

    # Content configuration
    sections: ReportSections = Field(
        default_factory=ReportSections,
        description="Which sections to include in the report"
    )

    # Format preference
    format: ReportFormat = Field(default=ReportFormat.PDF, description="Report output format")
    include_inline_html: bool = Field(
        default=True,
        description="Include HTML preview in email body (in addition to attachment)"
    )

    # Subscription state
    is_active: bool = Field(default=True, description="Whether subscription is active")
    next_report_at: Optional[datetime] = Field(default=None, description="When next report is scheduled")
    last_report_at: Optional[datetime] = Field(default=None, description="When last report was sent")
    total_reports_sent: int = Field(default=0, description="Total number of reports sent")


class ReportHistory(BaseFeatureModel):
    """
    Record of a generated report.

    Tracks:
    - Generation status
    - Report content snapshot
    - Delivery information
    """
    subscription_id: str = Field(..., description="ID of the subscription that triggered this report")
    user_id: str = Field(..., description="Firebase UID")

    # Report period
    report_period_start: datetime = Field(..., description="Start of reporting period")
    report_period_end: datetime = Field(..., description="End of reporting period")
    frequency: ReportFrequency = Field(..., description="Frequency at time of generation")

    # Generation status
    status: ReportStatus = Field(default=ReportStatus.PENDING, description="Current status")
    error_message: Optional[str] = Field(default=None, description="Error details if failed")

    # Content snapshot (for debugging)
    portfolio_snapshot: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Snapshot of portfolio data used"
    )
    sections_generated: List[str] = Field(
        default_factory=list,
        description="Which sections were included"
    )

    # Delivery information
    email_address: str = Field(..., description="Email address report was sent to")
    sent_at: Optional[datetime] = Field(default=None, description="When email was sent")
    resend_message_id: Optional[str] = Field(default=None, description="Resend API message ID")

    # Storage (optional for download)
    pdf_storage_key: Optional[str] = Field(default=None, description="S3/storage key for PDF")
    pdf_size_bytes: Optional[int] = Field(default=None, description="PDF file size")


# =============================================================================
# API Request/Response Models
# =============================================================================

class CreateSubscriptionRequest(BaseModel):
    """Request to create a new report subscription"""
    email_address: EmailStr
    frequency: ReportFrequency = ReportFrequency.MONTHLY
    preferred_day: int = Field(default=1, ge=0, le=31)
    preferred_time_utc: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    timezone: str = "UTC"
    portfolio_ids: List[str] = Field(default_factory=list)
    include_all_portfolios: bool = True
    sections: ReportSections = Field(default_factory=ReportSections)
    format: ReportFormat = ReportFormat.PDF
    include_inline_html: bool = True


class UpdateSubscriptionRequest(BaseModel):
    """Request to update subscription settings"""
    email_address: Optional[EmailStr] = None
    frequency: Optional[ReportFrequency] = None
    preferred_day: Optional[int] = Field(default=None, ge=0, le=31)
    preferred_time_utc: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: Optional[str] = None
    portfolio_ids: Optional[List[str]] = None
    include_all_portfolios: Optional[bool] = None
    sections: Optional[ReportSections] = None
    format: Optional[ReportFormat] = None
    include_inline_html: Optional[bool] = None


class SubscriptionResponse(BaseModel):
    """Response containing subscription details"""
    id: str
    email_address: str
    email_verified: bool
    frequency: ReportFrequency
    preferred_day: int
    preferred_time_utc: str
    timezone: str
    portfolio_ids: List[str]
    include_all_portfolios: bool
    sections: ReportSections
    format: ReportFormat
    include_inline_html: bool
    is_active: bool
    next_report_at: Optional[datetime]
    last_report_at: Optional[datetime]
    total_reports_sent: int
    created_at: datetime
    updated_at: datetime


class PreviewReportRequest(BaseModel):
    """Request to preview a report"""
    portfolio_ids: List[str] = Field(default_factory=list)
    include_all_portfolios: bool = True
    sections: ReportSections = Field(default_factory=ReportSections)
    format: ReportFormat = ReportFormat.HTML


class EmailVerificationRequest(BaseModel):
    """Request to verify email for reports"""
    email_address: EmailStr


class ReportHistoryItem(BaseModel):
    """Response model for report history"""
    id: str
    report_period_start: datetime
    report_period_end: datetime
    frequency: ReportFrequency
    status: ReportStatus
    email_address: str
    sent_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime


class ReportSectionInfo(BaseModel):
    """Information about an available report section"""
    key: str
    name: str
    description: str
    requires_data: Optional[str] = None  # e.g., "tags", "historical_prices"


# List of available sections for frontend display
AVAILABLE_REPORT_SECTIONS: List[ReportSectionInfo] = [
    ReportSectionInfo(
        key="portfolio_summary",
        name="Portfolio Summary",
        description="Total portfolio value and change since last report"
    ),
    ReportSectionInfo(
        key="asset_allocation",
        name="Asset Allocation",
        description="Pie chart showing distribution by security type (stocks, ETFs, bonds, etc.)"
    ),
    ReportSectionInfo(
        key="holdings_table",
        name="Top Holdings",
        description="Table of your largest positions with current values"
    ),
    ReportSectionInfo(
        key="performance_chart",
        name="Performance Chart",
        description="Line chart showing portfolio value over the reporting period",
        requires_data="historical_prices"
    ),
    ReportSectionInfo(
        key="sector_breakdown",
        name="Sector Breakdown",
        description="Distribution across market sectors",
        requires_data="tags"
    ),
    ReportSectionInfo(
        key="geographical_breakdown",
        name="Geographic Distribution",
        description="Distribution by geographic region",
        requires_data="tags"
    ),
    ReportSectionInfo(
        key="concentration_analysis",
        name="Concentration Analysis",
        description="Risk metrics including top holdings concentration"
    ),
    ReportSectionInfo(
        key="options_vesting",
        name="Options & RSU Vesting",
        description="Upcoming vesting events for stock options and RSUs"
    ),
    ReportSectionInfo(
        key="ai_insights",
        name="AI Insights",
        description="AI-generated analysis and recommendations for your portfolio"
    ),
]
