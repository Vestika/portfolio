"""Priority-aware async work queue with retry support."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from datetime import date
from enum import IntEnum
from uuid import uuid4


class TaskPriority(IntEnum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3


@dataclass(order=True)
class FetchTask:
    """A unit of work for the writer.

    Ordered by ``(priority, created_at)`` so higher priority goes first,
    and within the same priority, FIFO.
    """

    priority: TaskPriority = field(compare=True)
    created_at: float = field(compare=True, default_factory=time.monotonic)
    symbol: str = field(compare=False, default="")
    market: str = field(compare=False, default="US")
    start_date: date = field(compare=False, default_factory=date.today)
    end_date: date = field(compare=False, default_factory=date.today)
    retries: int = field(compare=False, default=0)
    task_id: str = field(compare=False, default_factory=lambda: uuid4().hex[:8])


class PriorityWorkQueue:
    """Priority-aware async work queue with deduplication and retry.

    Tasks are ordered by ``(priority, created_at)`` -- highest priority first,
    then FIFO within the same priority level.

    Deduplication: if a symbol already has a pending task, a new enqueue
    either upgrades the priority (if higher) or is silently dropped.
    """

    def __init__(self) -> None:
        self._queue: asyncio.PriorityQueue[FetchTask] = asyncio.PriorityQueue()
        self._pending: dict[str, FetchTask] = {}
        self._lock = asyncio.Lock()

    async def enqueue(self, task: FetchTask) -> None:
        """Add task.  Deduplicates by symbol -- upgrades priority if higher."""
        async with self._lock:
            existing = self._pending.get(task.symbol)
            if existing is not None:
                if task.priority < existing.priority:
                    # Upgrade: remove old reference, add new
                    self._pending[task.symbol] = task
                    await self._queue.put(task)
                # else: silently drop (existing has same or higher priority)
                return
            self._pending[task.symbol] = task
            await self._queue.put(task)

    async def dequeue(self) -> FetchTask:
        """Get next highest-priority task.  Blocks if empty.

        Skips stale entries (from priority upgrades) transparently.
        """
        while True:
            task = await self._queue.get()
            async with self._lock:
                current = self._pending.get(task.symbol)
                if current is not None and current.task_id == task.task_id:
                    del self._pending[task.symbol]
                    return task
                # Stale entry -- skip

    async def requeue_with_delay(self, task: FetchTask, delay: float) -> None:
        """Put failed task back with incremented retry count, after *delay*."""
        task.retries += 1
        task.created_at = time.monotonic()
        task.task_id = uuid4().hex[:8]

        async def _delayed() -> None:
            await asyncio.sleep(delay)
            await self.enqueue(task)

        asyncio.create_task(_delayed())

    def has_pending(self, symbol: str) -> bool:
        """Check if *symbol* already has a pending task."""
        return symbol in self._pending

    @property
    def size(self) -> int:
        return len(self._pending)

    @property
    def pending_symbols(self) -> set[str]:
        return set(self._pending.keys())
