from .base_model import BaseFeatureModel
from pydantic import Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class SymbolType(str, Enum):
    NYSE = "nyse"
    NASDAQ = "nasdaq"
    TASE = "tase"
    CURRENCY = "currency"
    CRYPTO = "crypto"
    OTHER = "other"


class Symbol(BaseFeatureModel):
    symbol: str = Field(..., description="The symbol identifier (e.g., AAPL, BEZEQ.TA)")
    name: str = Field(..., description="The full name (e.g., Apple Inc., Bezeq Group)")
    symbol_type: SymbolType = Field(..., description="Type of symbol")
    currency: str = Field(..., description="Currency of the symbol")
    search_terms: List[str] = Field(default_factory=list, description="Additional search terms")
    
    # TASE-specific fields
    tase_id: Optional[str] = Field(None, description="TASE ID for Israeli securities")
    short_name: Optional[str] = Field(None, description="Short name for display")
    
    # Additional metadata
    market: Optional[str] = Field(None, description="Market/exchange")
    sector: Optional[str] = Field(None, description="Industry sector")
    is_active: bool = Field(default=True, description="Whether the symbol is active")
    
    # Logo caching fields
    logo_url: Optional[str] = Field(None, description="Cached logo URL for the symbol")
    logo_updated_at: Optional[datetime] = Field(None, description="When the logo was last updated")
