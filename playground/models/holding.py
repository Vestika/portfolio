from dataclasses import dataclass
from typing import Any, Self


@dataclass
class Holding:
    symbol: str
    units: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            symbol=data["symbol"],
            units=int(data["units"]),
        )
