"""Data models for browser extension functionality"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid


class ExtensionConfig(BaseModel):
    """Shared configuration for extracting data from brokerage websites"""
    id: Optional[str] = None
    name: str
    url: str  # URL pattern with wildcards (e.g., https://fidelity.com/portfolio/*)
    full_url: bool = True  # True = send full page, False = use CSS selector
    selector: Optional[str] = None  # CSS selector if full_url = False
    source_url: Optional[str] = None  # Original URL this config is for (for display)
    created_by: Optional[str] = None  # user_id
    is_public: bool = True  # Allow community sharing
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ExtractionSession(BaseModel):
    """Temporary storage for extraction results before import"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    status: str = "processing"  # processing, completed, failed
    extracted_holdings: List['ExtractedHolding'] = []
    extraction_metadata: dict = {}
    error_message: Optional[str] = None
    source_url: Optional[str] = None  # URL where extraction happened
    selector: Optional[str] = None  # CSS selector used
    html_body: Optional[str] = None  # Store HTML for background processing
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PrivateExtensionConfig(BaseModel):
    """User-specific mapping of shared config to portfolio/account"""
    id: Optional[str] = None
    user_id: str
    extension_config_id: str  # References ExtensionConfig
    portfolio_id: str
    account_id: str
    auto_sync: bool = False  # Enable automatic sync on page load
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ExtractedHolding(BaseModel):
    """Single holding extracted from HTML"""
    symbol: str
    units: float
    cost_basis: Optional[float] = None
    security_name: Optional[str] = None
    confidence_score: float = 0.0  # AI confidence (0.0 - 1.0)


class ExtractHoldingsRequest(BaseModel):
    """Request to extract holdings from HTML"""
    html_body: str
    source_url: Optional[str] = None  # URL where extraction happened
    selector: Optional[str] = None  # CSS selector used


class ExtractHoldingsResponse(BaseModel):
    """Response from extraction endpoint - returns session ID"""
    session_id: str


class ImportHoldingsRequest(BaseModel):
    """Request to import holdings into portfolio"""
    session_id: str  # References ExtractionSession
    portfolio_id: str
    account_id: Optional[str] = None  # If None, create new account
    account_name: Optional[str] = None  # Required if account_id is None
    account_type: str = "taxable-brokerage"
    replace_holdings: bool = False  # True = replace all, False = merge


class ImportHoldingsResponse(BaseModel):
    """Response from import endpoint"""
    success: bool
    portfolio_id: str
    account_id: str
    account_name: str
    imported_holdings_count: int
    message: str
