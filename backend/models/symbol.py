from .base_model import BaseFeatureModel, FeatureConfig, AuthType
from pydantic import Field
from typing import Optional, List
from enum import Enum


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

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        return FeatureConfig(
            collection_name="symbols",
            auth_required=AuthType.NONE,
            enable_create=True,
            enable_read=True,
            enable_update=True,
            enable_delete=True,
            enable_list=True,
            async_operations=True,
        ) 