from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Asset(BaseModel):
    symbol: str
    shares: float

class PortfolioCreate(BaseModel):
    name: str
    assets: List[Asset]
    created_at: datetime
    updated_at: datetime

class PortfolioRead(PortfolioCreate):
    id: str = Field(..., alias="_id")
    
    class Config:
        allow_population_by_field_name = True

class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    assets: Optional[List[Asset]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None 