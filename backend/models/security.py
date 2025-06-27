from dataclasses import dataclass, field
from typing import Optional, Any, Self

from backend.models.currency import Currency
from backend.models.security_type import SecurityType


@dataclass
class Security:
    symbol: str
    name: str
    security_type: SecurityType
    currency: Currency
    tags: dict[str, Any] = field(default_factory=dict)
    unit_price: Optional[float] = None

    @classmethod
    def from_dict(cls, symbol: str, data: dict[str, Any]) -> Self:
        return cls(
            symbol=symbol,
            name=data["name"],
            security_type=SecurityType(data["type"]),
            currency=Currency(data["currency"]),
            tags=data.get("tags", {}),
            unit_price=data.get("unit_price"),
        )
