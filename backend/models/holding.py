from dataclasses import dataclass
from typing import Any, Self


@dataclass
class Holding:
    symbol: str
    units: float  # Changed from int to float to support fractional units

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            symbol=data["symbol"],
            units=float(data["units"]),
        )
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "units": self.units
        }
