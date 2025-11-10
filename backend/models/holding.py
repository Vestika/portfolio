from dataclasses import dataclass
from typing import Any, Self, Optional


@dataclass
class Holding:
    symbol: str
    units: float
    property_metadata: Optional[dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            symbol=data["symbol"],
            units=float(data["units"]),
            property_metadata=data.get("property_metadata"),
        )
