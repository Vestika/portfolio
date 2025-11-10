from dataclasses import dataclass
from typing import Any, Self, Optional


@dataclass
class Holding:
    symbol: str
    units: int
    property_metadata: Optional[dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            symbol=data["symbol"],
            units=int(data["units"]),
            property_metadata=data.get("property_metadata"),
        )
