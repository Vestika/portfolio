"""PriorityWorkQueue unit tests."""

import asyncio
from datetime import date

import pytest

from services.market_data.writer.work_queue import FetchTask, PriorityWorkQueue, TaskPriority


def _task(symbol: str, priority: TaskPriority = TaskPriority.NORMAL) -> FetchTask:
    return FetchTask(symbol=symbol, market="US", priority=priority, start_date=date.today(), end_date=date.today())


class TestPriorityWorkQueue:
    async def test_enqueue_dequeue_fifo_same_priority(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("A"))
        await q.enqueue(_task("B"))
        await q.enqueue(_task("C"))
        assert (await q.dequeue()).symbol == "A"
        assert (await q.dequeue()).symbol == "B"
        assert (await q.dequeue()).symbol == "C"

    async def test_priority_ordering(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("LOW", TaskPriority.LOW))
        await q.enqueue(_task("NORMAL", TaskPriority.NORMAL))
        await q.enqueue(_task("HIGH", TaskPriority.HIGH))
        assert (await q.dequeue()).symbol == "HIGH"
        assert (await q.dequeue()).symbol == "NORMAL"
        assert (await q.dequeue()).symbol == "LOW"

    async def test_critical_always_first(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("A", TaskPriority.NORMAL))
        await q.enqueue(_task("B", TaskPriority.NORMAL))
        await q.enqueue(_task("C", TaskPriority.CRITICAL))
        assert (await q.dequeue()).symbol == "C"

    async def test_dequeue_blocks_when_empty(self):
        q = PriorityWorkQueue()
        result: list[str] = []

        async def consumer():
            t = await q.dequeue()
            result.append(t.symbol)

        task = asyncio.create_task(consumer())
        await asyncio.sleep(0.05)
        assert result == []  # Still waiting
        await q.enqueue(_task("LATE"))
        await asyncio.sleep(0.05)
        assert result == ["LATE"]
        await task

    async def test_deduplication_skips_lower_priority(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("AAPL", TaskPriority.NORMAL))
        await q.enqueue(_task("AAPL", TaskPriority.LOW))  # Should be dropped
        assert q.size == 1

    async def test_deduplication_upgrades_priority(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("AAPL", TaskPriority.LOW))
        await q.enqueue(_task("OTHER", TaskPriority.NORMAL))
        await q.enqueue(_task("AAPL", TaskPriority.HIGH))  # Upgrade
        # AAPL should come first (HIGH) even though OTHER (NORMAL) was enqueued before upgrade
        first = await q.dequeue()
        assert first.symbol == "AAPL"

    async def test_requeue_with_delay(self):
        q = PriorityWorkQueue()
        task = _task("AAPL")
        await q.requeue_with_delay(task, 0.05)
        # Not available immediately
        assert q.size == 0
        await asyncio.sleep(0.1)
        assert q.size == 1
        t = await q.dequeue()
        assert t.symbol == "AAPL"
        assert t.retries == 1

    async def test_has_pending(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("AAPL"))
        assert q.has_pending("AAPL")
        assert not q.has_pending("MSFT")

    async def test_size_tracking(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("A"))
        await q.enqueue(_task("B"))
        await q.enqueue(_task("C"))
        assert q.size == 3
        await q.dequeue()
        assert q.size == 2

    async def test_pending_symbols(self):
        q = PriorityWorkQueue()
        await q.enqueue(_task("AAPL"))
        await q.enqueue(_task("MSFT"))
        assert q.pending_symbols == {"AAPL", "MSFT"}
