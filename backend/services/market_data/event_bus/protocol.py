"""Event bus protocol and message types."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Protocol, runtime_checkable


class EventType(str, Enum):
    DATA_WRITTEN = "data_written"
    REFRESH_REQUEST = "refresh_request"
    SYMBOL_ADDED = "symbol_added"


@dataclass
class Event:
    type: EventType
    symbols: list[str] | None = None  # None means "all symbols"
    metadata: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class EventBus(Protocol):
    async def publish(self, event: Event) -> None: ...
    async def subscribe(self, event_type: EventType, handler: Callable[[Event], Awaitable[None]]) -> None: ...
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
