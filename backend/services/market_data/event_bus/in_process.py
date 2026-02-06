"""In-process event bus using asyncio queues."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Awaitable, Callable

from loguru import logger

from .protocol import Event, EventBus, EventType


class InProcessEventBus:
    """asyncio.Queue-based event bus for in-process communication.

    Each subscriber gets its own queue and a background task that drains it.
    Publishing puts the event into every subscriber queue for the matching type.

    Can be swapped for Redis Pub/Sub or RabbitMQ by implementing the same
    :class:`EventBus` protocol.
    """

    def __init__(self) -> None:
        self._handlers: dict[EventType, list[Callable[[Event], Awaitable[None]]]] = defaultdict(list)
        self._queues: dict[EventType, list[asyncio.Queue[Event]]] = defaultdict(list)
        self._tasks: list[asyncio.Task[None]] = []
        self._started = False

    async def subscribe(self, event_type: EventType, handler: Callable[[Event], Awaitable[None]]) -> None:
        """Register a handler for an event type.

        If the bus is already started, the consumer task is spawned immediately.
        """
        queue: asyncio.Queue[Event] = asyncio.Queue()
        self._handlers[event_type].append(handler)
        self._queues[event_type].append(queue)
        if self._started:
            self._tasks.append(asyncio.create_task(self._consumer(queue, handler)))

    async def publish(self, event: Event) -> None:
        """Dispatch *event* to all subscribers of its type."""
        if not self._started:
            raise RuntimeError("EventBus not started -- call start() first")
        for queue in self._queues.get(event.type, []):
            await queue.put(event)

    async def start(self) -> None:
        """Start consumer tasks for all registered handlers."""
        if self._started:
            return
        self._started = True
        for event_type, queues in self._queues.items():
            handlers = self._handlers[event_type]
            for queue, handler in zip(queues, handlers):
                self._tasks.append(asyncio.create_task(self._consumer(queue, handler)))

    async def stop(self) -> None:
        """Cancel all consumer tasks and drain queues."""
        self._started = False
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _consumer(self, queue: asyncio.Queue[Event], handler: Callable[[Event], Awaitable[None]]) -> None:
        """Drain *queue* and invoke *handler* for each event."""
        try:
            while True:
                event = await queue.get()
                try:
                    await handler(event)
                except Exception:
                    logger.exception("Event handler raised an exception")
                finally:
                    queue.task_done()
        except asyncio.CancelledError:
            pass
