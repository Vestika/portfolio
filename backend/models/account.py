from dataclasses import dataclass
from typing import Any, Self, Optional
from enum import Enum

from models.holding import Holding
from models.ibkr_account import IBKRAccountConfig


class AccountProvider(str, Enum):
    """Supported account providers"""
    MANUAL = "manual"
    IBKR_FLEX = "ibkr_flex"
    IBKR_WEB_API = "ibkr_web_api"


@dataclass
class AccountConnection:
    """Connection details for external account providers"""
    provider: AccountProvider
    account_id: Optional[str] = None
    credentials: Optional[dict[str, Any]] = None
    last_sync: Optional[str] = None
    sync_status: str = "idle"  # idle, syncing, success, error
    sync_error: Optional[str] = None


@dataclass
class Account:
    name: str
    holdings: list[Holding]
    properties: dict[str, Any]
    rsu_plans: list[Any] = None
    espp_plans: list[Any] = None
    options_plans: list[Any] = None
    ibkr_config: Optional[IBKRAccountConfig] = None
    connection: Optional[AccountConnection] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        ibkr_config = None
        if data.get("ibkr_config"):
            ibkr_config = IBKRAccountConfig.from_dict(data["ibkr_config"])
        
        connection = None
        if data.get("connection"):
            connection = AccountConnection(**data["connection"])
        
        return cls(
            name=data["name"],
            holdings=[Holding.from_dict(h) for h in data.get("holdings", [])],
            properties=data.get("properties", {}),
            rsu_plans=data.get("rsu_plans", []),
            espp_plans=data.get("espp_plans", []),
            options_plans=data.get("options_plans", []),
            ibkr_config=ibkr_config,
            connection=connection
        )
    
    def to_dict(self) -> dict[str, Any]:
        """Convert account to dictionary"""
        return {
            "name": self.name,
            "holdings": [h.to_dict() for h in self.holdings],
            "properties": self.properties,
            "rsu_plans": self.rsu_plans or [],
            "espp_plans": self.espp_plans or [],
            "options_plans": self.options_plans or [],
            "ibkr_config": self.ibkr_config.to_dict() if self.ibkr_config else None,
            "connection": self.connection.__dict__ if self.connection else None
        }
