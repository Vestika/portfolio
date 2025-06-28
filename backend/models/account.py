from dataclasses import dataclass
from typing import Any, Self

from models.holding import Holding


@dataclass
class Account:
    name: str
    holdings: list[Holding]
    properties: dict[str, Any]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            name=data["name"],
            holdings=[Holding.from_dict(h) for h in data.get("holdings", [])],
            properties=data.get("properties", {}),
        )
