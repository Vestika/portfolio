from dataclasses import dataclass
from typing import Any, Self

from models.holding import Holding


@dataclass
class Account:
    name: str
    holdings: list[Holding]
    properties: dict[str, Any]
    rsu_plans: list[Any] = None
    espp_plans: list[Any] = None
    options_plans: list[Any] = None
    recurring_investments: list[Any] = None  # Recurring investment/deposit configurations
    url: str | None = None  # URL associated with this account (for browser extension matching)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            name=data["name"],
            holdings=[Holding.from_dict(h) for h in data.get("holdings", [])],
            properties=data.get("properties", {}),
            rsu_plans=data.get("rsu_plans", []),
            espp_plans=data.get("espp_plans", []),
            options_plans=data.get("options_plans", []),
            recurring_investments=data.get("recurring_investments", []),
            url=data.get("url"),
        )
