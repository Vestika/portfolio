"""Data models for browser extension functionality"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ExtensionConfig(BaseModel):
    """Shared configuration for extracting data from brokerage websites"""
    id: Optional[str] = None
    name: str
    url: str  # URL pattern with wildcards (e.g., https://fidelity.com/portfolio/*)
    full_url: bool = True  # True = send full page, False = use CSS selector
    selector: Optional[str] = None  # CSS selector if full_url = False
    created_by: Optional[str] = None  # user_id
    is_public: bool = True  # Allow community sharing
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


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
    extension_config_id: str
    portfolio_id: Optional[str] = None  # For currency context


class ExtractHoldingsResponse(BaseModel):
    """Response from extraction endpoint"""
    holdings: List[ExtractedHolding]
    extraction_metadata: dict


class ImportHoldingsRequest(BaseModel):
    """Request to import holdings into portfolio"""
    portfolio_id: str
    account_id: Optional[str] = None  # If None, create new account
    account_name: Optional[str] = None  # Required if account_id is None
    account_type: str = "taxable-brokerage"
    holdings: List[dict]  # [{"symbol": "AAPL", "units": 150}, ...]
    replace_holdings: bool = True  # True = replace all, False = merge


class ImportHoldingsResponse(BaseModel):
    """Response from import endpoint"""
    success: bool
    portfolio_id: str
    account_id: str
    account_name: str
    imported_holdings_count: int
    message: str
