from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum

class TagType(str, Enum):
    ENUM = "enum"           # Categorical values
    MAP = "map"             # Weighted exposure (key-value pairs with float values)
    SCALAR = "scalar"       # Single number, date, or string
    HIERARCHICAL = "hierarchical"  # Nested/path-based tags
    BOOLEAN = "boolean"     # Yes/no flags
    TIME_BASED = "time_based"  # Date ranges, durations
    RELATIONSHIP = "relationship"  # Links to other holdings

class ScalarDataType(str, Enum):
    FLOAT = "float"
    INTEGER = "integer"
    PERCENTAGE = "percentage"
    CURRENCY = "currency"
    DATE = "date"
    STRING = "string"

class TagDefinition(BaseModel):
    """Defines the structure and constraints for a tag"""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User who owns this tag definition")
    name: str = Field(..., description="Unique name for this tag")
    display_name: str = Field(..., description="Human-readable display name")
    description: Optional[str] = Field(None, description="Description of what this tag represents")
    tag_type: TagType = Field(..., description="Type of tag")
    
    # For ENUM tags
    enum_values: Optional[List[str]] = Field(None, description="Allowed values for enum tags")
    
    # For SCALAR tags
    scalar_data_type: Optional[ScalarDataType] = Field(None, description="Data type for scalar values")
    min_value: Optional[float] = Field(None, description="Minimum value for numeric scalars")
    max_value: Optional[float] = Field(None, description="Maximum value for numeric scalars")
    
    # For MAP tags
    map_key_type: Optional[str] = Field(None, description="Type of keys for map tags (e.g., 'country', 'sector')")
    allowed_keys: Optional[List[str]] = Field(None, description="Allowed keys for map tags")
    
    # For HIERARCHICAL tags
    max_depth: Optional[int] = Field(None, description="Maximum nesting depth for hierarchical tags")
    path_separator: str = Field(default=" > ", description="Separator for hierarchical paths")
    
    # For TIME_BASED tags
    time_format: Optional[str] = Field(None, description="Expected format for time-based tags")
    
    # For RELATIONSHIP tags
    relationship_type: Optional[str] = Field(None, description="Type of relationship (e.g., 'hedged_by', 'underlying_of')")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)
    
    @validator('enum_values')
    def validate_enum_values(cls, v, values):
        if values.get('tag_type') == TagType.ENUM and not v:
            raise ValueError('enum_values is required for ENUM tags')
        return v
    
    @validator('scalar_data_type')
    def validate_scalar_data_type(cls, v, values):
        if values.get('tag_type') == TagType.SCALAR and not v:
            raise ValueError('scalar_data_type is required for SCALAR tags')
        return v

class TagValue(BaseModel):
    """Represents the actual value of a tag for a holding"""
    tag_name: str = Field(..., description="Name of the tag definition")
    tag_type: TagType = Field(..., description="Type of tag")
    
    # Different value types - only one should be set based on tag_type
    enum_value: Optional[str] = Field(None, description="Value for ENUM tags")
    map_value: Optional[Dict[str, float]] = Field(None, description="Value for MAP tags")
    scalar_value: Optional[Union[float, int, str]] = Field(None, description="Value for SCALAR tags")
    hierarchical_value: Optional[List[str]] = Field(None, description="Path for HIERARCHICAL tags")
    boolean_value: Optional[bool] = Field(None, description="Value for BOOLEAN tags")
    time_value: Optional[Dict[str, Any]] = Field(None, description="Value for TIME_BASED tags")
    relationship_value: Optional[List[str]] = Field(None, description="Referenced symbols for RELATIONSHIP tags")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def get_display_value(self) -> str:
        """Returns a human-readable representation of the tag value"""
        if self.tag_type == TagType.ENUM:
            return self.enum_value or ""
        elif self.tag_type == TagType.MAP:
            if not self.map_value:
                return ""
            return ", ".join([f"{k}: {v:.1%}" for k, v in self.map_value.items()])
        elif self.tag_type == TagType.SCALAR:
            return str(self.scalar_value) if self.scalar_value is not None else ""
        elif self.tag_type == TagType.HIERARCHICAL:
            return " > ".join(self.hierarchical_value) if self.hierarchical_value else ""
        elif self.tag_type == TagType.BOOLEAN:
            return "Yes" if self.boolean_value else "No"
        elif self.tag_type == TagType.TIME_BASED:
            if not self.time_value:
                return ""
            if 'date' in self.time_value:
                return str(self.time_value['date'])
            elif 'start_date' in self.time_value and 'end_date' in self.time_value:
                return f"{self.time_value['start_date']} to {self.time_value['end_date']}"
            return str(self.time_value)
        elif self.tag_type == TagType.RELATIONSHIP:
            return ", ".join(self.relationship_value) if self.relationship_value else ""
        return ""

class HoldingTags(BaseModel):
    """Collection of tags for a specific holding"""
    symbol: str = Field(..., description="Symbol this tag collection belongs to")
    user_id: str = Field(..., description="User who owns these tags")
    portfolio_id: Optional[str] = Field(None, description="Portfolio ID (optional, for portfolio-specific tags)")
    tags: Dict[str, TagValue] = Field(default_factory=dict, description="Dictionary of tag name to tag value")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TagLibrary(BaseModel):
    """User's complete tag library"""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User who owns this tag library")
    tag_definitions: Dict[str, TagDefinition] = Field(default_factory=dict, description="User's tag definitions")
    
    # Common tag templates that users can quickly adopt
    template_tags: Dict[str, TagDefinition] = Field(default_factory=dict, description="Available template tags")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def get_tag_definition(self, tag_name: str) -> Optional[TagDefinition]:
        """Get a tag definition by name"""
        return self.tag_definitions.get(tag_name)
    
    def add_tag_definition(self, tag_def: TagDefinition) -> None:
        """Add or update a tag definition"""
        tag_def.updated_at = datetime.utcnow()
        self.tag_definitions[tag_def.name] = tag_def
        self.updated_at = datetime.utcnow()

# Predefined template tags that users can quickly adopt
DEFAULT_TAG_TEMPLATES = {
    "investment_intent": TagDefinition(
        name="investment_intent",
        display_name="Investment Intent",
        description="Primary investment strategy for this holding",
        tag_type=TagType.ENUM,
        enum_values=["Growth", "Income", "Speculation", "Safety", "Diversification"],
        user_id="template"
    ),
    "sector": TagDefinition(
        name="sector",
        display_name="Sector",
        description="Industry sector classification",
        tag_type=TagType.ENUM,
        enum_values=["Technology", "Healthcare", "Financial", "Energy", "Real Estate", "Consumer", "Industrial", "Utilities", "Materials", "Telecommunications"],
        user_id="template"
    ),
    "tax_treatment": TagDefinition(
        name="tax_treatment",
        display_name="Tax Treatment",
        description="Tax status of the holding",
        tag_type=TagType.ENUM,
        enum_values=["Taxable", "Tax-free", "Deferred", "IRA", "401k", "Roth"],
        user_id="template"
    ),
    "geographic_exposure": TagDefinition(
        name="geographic_exposure",
        display_name="Geographic Exposure",
        description="Geographic/country exposure weights",
        tag_type=TagType.MAP,
        map_key_type="country",
        allowed_keys=["US", "EU", "Asia", "Emerging", "Global"],
        user_id="template"
    ),
    "esg_score": TagDefinition(
        name="esg_score",
        display_name="ESG Score",
        description="Environmental, Social, Governance scoring",
        tag_type=TagType.MAP,
        map_key_type="esg_factor",
        allowed_keys=["Environment", "Social", "Governance"],
        user_id="template"
    ),
    "annual_dividend_yield": TagDefinition(
        name="annual_dividend_yield",
        display_name="Annual Dividend Yield",
        description="Expected annual dividend yield percentage",
        tag_type=TagType.SCALAR,
        scalar_data_type=ScalarDataType.PERCENTAGE,
        min_value=0.0,
        max_value=100.0,
        user_id="template"
    ),
    "years_held": TagDefinition(
        name="years_held",
        display_name="Years Held",
        description="Number of years holding this security",
        tag_type=TagType.SCALAR,
        scalar_data_type=ScalarDataType.FLOAT,
        min_value=0.0,
        user_id="template"
    ),
    "target_sale_price": TagDefinition(
        name="target_sale_price",
        display_name="Target Sale Price",
        description="Target price for selling this holding",
        tag_type=TagType.SCALAR,
        scalar_data_type=ScalarDataType.CURRENCY,
        min_value=0.0,
        user_id="template"
    ),
    "risk_score": TagDefinition(
        name="risk_score",
        display_name="Risk Score",
        description="Personal risk assessment (1-10 scale)",
        tag_type=TagType.SCALAR,
        scalar_data_type=ScalarDataType.INTEGER,
        min_value=1,
        max_value=10,
        user_id="template"
    ),
    "conviction_level": TagDefinition(
        name="conviction_level",
        display_name="Conviction Level",
        description="Personal conviction in this investment (1-5 scale)",
        tag_type=TagType.SCALAR,
        scalar_data_type=ScalarDataType.INTEGER,
        min_value=1,
        max_value=5,
        user_id="template"
    ),
    "investment_goal": TagDefinition(
        name="investment_goal",
        display_name="Investment Goal",
        description="Hierarchical investment goal classification",
        tag_type=TagType.HIERARCHICAL,
        max_depth=3,
        path_separator=" > ",
        user_id="template"
    ),
    "is_esg_compliant": TagDefinition(
        name="is_esg_compliant",
        display_name="ESG Compliant",
        description="Whether this holding meets ESG criteria",
        tag_type=TagType.BOOLEAN,
        user_id="template"
    ),
    "liquidity_buffer": TagDefinition(
        name="liquidity_buffer",
        display_name="Use in Liquidity Buffer",
        description="Include this holding in emergency liquidity calculations",
        tag_type=TagType.BOOLEAN,
        user_id="template"
    ),
    "tax_loss_harvest": TagDefinition(
        name="tax_loss_harvest",
        display_name="Avoid for Tax Reasons",
        description="Avoid selling this holding for tax optimization",
        tag_type=TagType.BOOLEAN,
        user_id="template"
    ),
    "under_restriction": TagDefinition(
        name="under_restriction",
        display_name="Under Legal Restriction",
        description="This holding has legal restrictions on trading",
        tag_type=TagType.BOOLEAN,
        user_id="template"
    ),
    "option_collateral": TagDefinition(
        name="option_collateral",
        display_name="Option Collateral",
        description="This holding is used as collateral for options",
        tag_type=TagType.BOOLEAN,
        user_id="template"
    ),
    "hold_until": TagDefinition(
        name="hold_until",
        display_name="Hold Until",
        description="Target date to hold this investment until",
        tag_type=TagType.TIME_BASED,
        time_format="YYYY-MM-DD",
        user_id="template"
    ),
    "review_frequency": TagDefinition(
        name="review_frequency",
        display_name="Review Frequency",
        description="How often to review this holding",
        tag_type=TagType.TIME_BASED,
        time_format="frequency",
        user_id="template"
    ),
    "hedged_by": TagDefinition(
        name="hedged_by",
        display_name="Hedged By",
        description="Other holdings that hedge this position",
        tag_type=TagType.RELATIONSHIP,
        relationship_type="hedge",
        user_id="template"
    ),
    "underlying_of": TagDefinition(
        name="underlying_of",
        display_name="Underlying Of",
        description="Derivative instruments based on this holding",
        tag_type=TagType.RELATIONSHIP,
        relationship_type="derivative",
        user_id="template"
    ),
    "strategy_group": TagDefinition(
        name="strategy_group",
        display_name="Strategy Group",
        description="Related holdings that are part of the same strategy",
        tag_type=TagType.RELATIONSHIP,
        relationship_type="strategy",
        user_id="template"
    )
} 