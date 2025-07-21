from dataclasses import dataclass
from typing import Optional, Dict, Any
from datetime import datetime


@dataclass
class IBKRAccountConfig:
    """Configuration for IBKR Flex Web Service integration"""
    
    flex_query_token: str
    flex_query_id: str
    last_sync: Optional[datetime] = None
    sync_status: str = "idle"  # idle, syncing, success, error
    sync_error: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IBKRAccountConfig":
        """Create IBKRAccountConfig from dictionary"""
        last_sync = None
        if data.get("last_sync"):
            try:
                last_sync = datetime.fromisoformat(data["last_sync"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            flex_query_token=data["flex_query_token"],
            flex_query_id=data["flex_query_id"],
            last_sync=last_sync,
            sync_status=data.get("sync_status", "idle"),
            sync_error=data.get("sync_error"),
            account_id=data.get("account_id"),
            account_name=data.get("account_name")
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "flex_query_token": self.flex_query_token,
            "flex_query_id": self.flex_query_id,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "sync_status": self.sync_status,
            "sync_error": self.sync_error,
            "account_id": self.account_id,
            "account_name": self.account_name
        }


@dataclass
class IBKRPosition:
    """Position data from IBKR Flex Web Service"""
    
    symbol: str
    units: float
    market_value: float
    currency: str = "USD"
    security_type: str = "STK"
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IBKRPosition":
        """Create IBKRPosition from dictionary"""
        return cls(
            symbol=data["symbol"],
            units=float(data["units"]),
            market_value=float(data["market_value"]),
            currency=data.get("currency", "USD"),
            security_type=data.get("security_type", "STK")
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "symbol": self.symbol,
            "units": self.units,
            "market_value": self.market_value,
            "currency": self.currency,
            "security_type": self.security_type
        }


@dataclass
class IBKRAccountData:
    """Account data from IBKR Flex Web Service"""
    
    account_id: str
    account_name: str
    currency: str
    cash_balances: Dict[str, float]
    positions: list[IBKRPosition]
    total_value: float
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IBKRAccountData":
        """Create IBKRAccountData from dictionary"""
        return cls(
            account_id=data["account_id"],
            account_name=data["account_name"],
            currency=data.get("currency", "USD"),
            cash_balances=data.get("cash_balances", {}),
            positions=[IBKRPosition.from_dict(pos) for pos in data.get("positions", [])],
            total_value=float(data.get("total_value", 0))
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "account_id": self.account_id,
            "account_name": self.account_name,
            "currency": self.currency,
            "cash_balances": self.cash_balances,
            "positions": [pos.to_dict() for pos in self.positions],
            "total_value": self.total_value
        } 