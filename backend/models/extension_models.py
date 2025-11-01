"""Data models for browser extension functionality"""
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field
import uuid


class SharedConfig(BaseModel):
    """Community-shared extraction configuration for popular financial sites"""
    config_id: Optional[str] = None  # Unique config ID (e.g., "cfg_robinhood_v1")
    site_name: str  # Human-readable name (e.g., "Robinhood")
    url_pattern: str  # Regex pattern (e.g., "^https://robinhood\\.com/(account|portfolio)")
    selector: Optional[str] = None  # CSS selector (null = full page)
    full_page: bool = True  # true = send full HTML, false = use selector

    # Metadata
    creator_id: Optional[str] = None  # User ID who created config
    creator_name: Optional[str] = None  # Display name (null if anonymous)
    is_public: bool = True  # Public vs. private
    verified: bool = False  # Verified by Vestika team or community
    status: str = "active"  # "active", "under_review", "deprecated"

    # Usage stats (denormalized for performance)
    enabled_users_count: int = 0  # Number of users who enabled this config
    successful_imports_count: int = 0  # Total successful imports completed with this config
    failure_count: int = 0  # Failed extractions/imports
    last_used_at: Optional[datetime] = None  # Last successful use

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Alias for backwards compatibility
ExtensionConfig = SharedConfig


class AutoImportOptions(BaseModel):
    """Options for automatically importing holdings after extraction"""
    portfolio_id: str
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    replace_holdings: bool = True


class ExtractionSession(BaseModel):
    """Temporary storage for extraction results before import"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    status: str = "processing"  # "processing", "completed", "failed", "requires_review"
    extracted_holdings: List['ExtractedHolding'] = []
    extraction_metadata: dict = {}
    error_message: Optional[str] = None
    source_url: Optional[str] = None  # URL where extraction happened
    selector: Optional[str] = None  # CSS selector used
    html_body: Optional[str] = None  # Store HTML for background processing

    # Auto-Sync Specific (new fields)
    auto_sync: bool = False  # Was this triggered by auto-sync?
    trigger: Literal["manual", "autosync", "upload"] = "manual"
    shared_config_id: Optional[str] = None
    private_config_id: Optional[str] = None  # If auto-sync, which config?
    auto_import: Optional[AutoImportOptions] = None
    auto_import_status: Optional[str] = None  # "pending", "processing", "success", "failed"
    auto_import_started_at: Optional[datetime] = None
    auto_import_completed_at: Optional[datetime] = None
    auto_import_error: Optional[str] = None
    auto_import_result: Optional[dict] = None
    previous_holdings: Optional[List[dict]] = None  # For conflict detection
    conflict_detected: bool = False  # Significant changes detected?
    conflict_reason: Optional[str] = None  # Why conflict was triggered

    created_at: datetime = Field(default_factory=datetime.utcnow)


class PrivateConfig(BaseModel):
    """User-specific mapping of shared config to portfolio/account (for auto-sync)"""
    private_config_id: Optional[str] = None  # Unique ID

    # User & Config
    user_id: str  # Owner
    shared_config_id: str  # References SharedConfig.config_id

    # Portfolio Mapping
    portfolio_id: str  # Target portfolio
    account_name: Optional[str] = None  # Target account (null = create new on import)
    account_type: Optional[str] = None  # For new account creation

    # Auto-Sync Settings
    enabled: bool = False  # Auto-sync enabled?
    auto_sync_enabled: bool = False  # Whether auto-sync should run automatically
    notification_preference: str = "notification_only"  # "notification_only" or "auto_redirect"
    last_sync_at: Optional[datetime] = None  # Last successful sync
    last_sync_status: Optional[str] = None  # "success", "failed", "conflict", null

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Alias for backwards compatibility
PrivateExtensionConfig = PrivateConfig


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
    shared_config_id: Optional[str] = None
    private_config_id: Optional[str] = None
    trigger: Literal["manual", "autosync", "upload"] = "manual"
    auto_import: Optional[AutoImportOptions] = None


class ExtractHoldingsResponse(BaseModel):
    """Response from extraction endpoint - returns session ID"""
    session_id: str


class ImportHoldingsRequest(BaseModel):
    """Request to import holdings into portfolio"""
    session_id: str  # References ExtractionSession
    portfolio_id: str  # Portfolio ID to import into
    account_name: Optional[str] = None  # Account name to import into (if exists, override; if new, create)
    account_type: str = "bank-account"  # Used only when creating new account (must match AccountSelector options)
    replace_holdings: bool = True  # Always replace (override) holdings in the account


class ImportHoldingsResponse(BaseModel):
    """Response from import endpoint"""
    success: bool
    portfolio_id: str
    account_id: str
    account_name: str
    imported_holdings_count: int
    message: str
