"""InProcessEventBus tests."""

import asyncio

import pytest

from services.market_data.event_bus.in_process import InProcessEventBus
from services.market_data.event_bus.protocol import Event, EventType


class TestInProcessEventBus:
    async def test_publish_subscribe(self, event_bus: InProcessEventBus):
        received: list[Event] = []

        async def handler(event: Event):
            received.append(event)

        await event_bus.subscribe(EventType.DATA_WRITTEN, handler)
        await event_bus.publish(Event(type=EventType.DATA_WRITTEN))
        await asyncio.sleep(0.05)
        assert len(received) == 1
        assert received[0].type == EventType.DATA_WRITTEN

    async def test_multiple_subscribers(self, event_bus: InProcessEventBus):
        results: list[str] = []

        async def handler_a(event: Event):
            results.append("a")

        async def handler_b(event: Event):
            results.append("b")

        await event_bus.subscribe(EventType.DATA_WRITTEN, handler_a)
        await event_bus.subscribe(EventType.DATA_WRITTEN, handler_b)
        await event_bus.publish(Event(type=EventType.DATA_WRITTEN))
        await asyncio.sleep(0.05)
        assert sorted(results) == ["a", "b"]

    async def test_different_event_types(self, event_bus: InProcessEventBus):
        written: list[Event] = []
        added: list[Event] = []

        async def on_written(event: Event):
            written.append(event)

        async def on_added(event: Event):
            added.append(event)

        await event_bus.subscribe(EventType.DATA_WRITTEN, on_written)
        await event_bus.subscribe(EventType.SYMBOL_ADDED, on_added)
        await event_bus.publish(Event(type=EventType.DATA_WRITTEN))
        await asyncio.sleep(0.05)
        assert len(written) == 1
        assert len(added) == 0

    async def test_event_contains_symbols(self, event_bus: InProcessEventBus):
        received: list[Event] = []

        async def handler(event: Event):
            received.append(event)

        await event_bus.subscribe(EventType.DATA_WRITTEN, handler)
        await event_bus.publish(Event(type=EventType.DATA_WRITTEN, symbols=["AAPL"]))
        await asyncio.sleep(0.05)
        assert received[0].symbols == ["AAPL"]

    async def test_event_all_symbols(self, event_bus: InProcessEventBus):
        received: list[Event] = []

        async def handler(event: Event):
            received.append(event)

        await event_bus.subscribe(EventType.DATA_WRITTEN, handler)
        await event_bus.publish(Event(type=EventType.DATA_WRITTEN, symbols=None))
        await asyncio.sleep(0.05)
        assert received[0].symbols is None

    async def test_handler_error_doesnt_break_bus(self, event_bus: InProcessEventBus):
        results: list[str] = []

        async def bad_handler(event: Event):
            raise RuntimeError("boom")

        async def good_handler(event: Event):
            results.append("ok")

        await event_bus.subscribe(EventType.DATA_WRITTEN, bad_handler)
        await event_bus.subscribe(EventType.DATA_WRITTEN, good_handler)
        await event_bus.publish(Event(type=EventType.DATA_WRITTEN))
        await asyncio.sleep(0.05)
        # Good handler still fires; bus didn't crash
        assert "ok" in results

    async def test_start_stop_lifecycle(self):
        bus = InProcessEventBus()
        received: list[Event] = []

        async def handler(event: Event):
            received.append(event)

        await bus.subscribe(EventType.DATA_WRITTEN, handler)
        await bus.start()
        await bus.publish(Event(type=EventType.DATA_WRITTEN))
        await asyncio.sleep(0.05)
        assert len(received) == 1
        await bus.stop()

    async def test_publish_before_start_raises(self):
        bus = InProcessEventBus()
        with pytest.raises(RuntimeError, match="not started"):
            await bus.publish(Event(type=EventType.DATA_WRITTEN))
