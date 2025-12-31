"""
Mixpanel analytics service for tracking user operations.

Features:
- Non-blocking async event queue
- Background worker with batching
- Graceful error handling
- Mock mode for testing
- User identification
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
import os

try:
    from mixpanel import Mixpanel
    MIXPANEL_AVAILABLE = True
except ImportError:
    MIXPANEL_AVAILABLE = False

from config import settings
from models.user_model import User

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Centralized analytics service for tracking user events in Mixpanel.

    Architecture:
    - Events are queued immediately (non-blocking)
    - Background worker processes queue in batches
    - Failures are logged but don't affect user operations
    - Mock mode for development/testing

    Usage:
        analytics = get_analytics_service()
        analytics.track_event(
            user=current_user,
            event_name="Portfolio Created",
            properties={"portfolio_id": "123", "base_currency": "USD"}
        )
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        enabled: bool = True,
        mock_mode: bool = False
    ):
        self.api_key = api_key or getattr(settings, 'mixpanel_api_key', None) or ""
        self.enabled = enabled and bool(self.api_key) and MIXPANEL_AVAILABLE
        self.mock_mode = mock_mode or getattr(settings, 'mixpanel_mock_mode', False)

        # Event queue and worker
        self.event_queue: Optional[asyncio.Queue] = None
        self.worker_task: Optional[asyncio.Task] = None
        self.shutdown_flag = asyncio.Event()

        # Mock mode event buffer (for testing)
        self.mock_events: List[Dict[str, Any]] = []

        # Initialize Mixpanel client
        if self.enabled and not self.mock_mode:
            try:
                self.mixpanel = Mixpanel(self.api_key)
                logger.info("✅ Mixpanel analytics initialized (Production Mode)")
            except Exception as e:
                logger.error(f"❌ Failed to initialize Mixpanel: {e}")
                self.enabled = False
                self.mixpanel = None
        elif self.mock_mode:
            self.mixpanel = None
            logger.info("🧪 Mixpanel analytics initialized (Mock Mode)")
        else:
            self.mixpanel = None
            logger.warning("⚠️ Mixpanel analytics disabled (no API key or SDK not available)")

    async def start(self):
        """Start the background worker. Called on app startup."""
        if not self.enabled and not self.mock_mode:
            return

        self.event_queue = asyncio.Queue(maxsize=10000)
        self.shutdown_flag.clear()
        self.worker_task = asyncio.create_task(self._background_worker())
        logger.info("🚀 Analytics background worker started")

    async def stop(self):
        """Stop the background worker gracefully. Called on app shutdown."""
        if self.worker_task:
            self.shutdown_flag.set()

            # Wait for worker to finish processing remaining events (with timeout)
            try:
                await asyncio.wait_for(self.worker_task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("⚠️ Analytics worker shutdown timeout, cancelling")
                self.worker_task.cancel()
                try:
                    await self.worker_task
                except asyncio.CancelledError:
                    pass

            logger.info("🛑 Analytics background worker stopped")

    async def _background_worker(self):
        """
        Background worker that processes events from queue and sends to Mixpanel.
        Batches events for efficiency and handles errors gracefully.
        """
        batch_size = 50
        batch_timeout = 5.0  # seconds

        while not self.shutdown_flag.is_set():
            try:
                events_batch = []

                # Collect events for batch (with timeout)
                try:
                    while len(events_batch) < batch_size:
                        timeout = batch_timeout if not events_batch else 0.1
                        event = await asyncio.wait_for(
                            self.event_queue.get(),
                            timeout=timeout
                        )
                        events_batch.append(event)
                except asyncio.TimeoutError:
                    pass  # Send whatever we have

                if not events_batch:
                    # If shutdown is set and no events, exit
                    if self.shutdown_flag.is_set():
                        break
                    continue

                # Send batch to Mixpanel
                if self.mock_mode:
                    self.mock_events.extend(events_batch)
                    logger.debug(f"🧪 [MOCK] Queued {len(events_batch)} events (total: {len(self.mock_events)})")
                else:
                    await self._send_batch(events_batch)

            except Exception as e:
                logger.error(f"❌ Analytics worker error: {e}", exc_info=True)
                await asyncio.sleep(1)  # Brief pause on error

    async def _send_batch(self, events: List[Dict[str, Any]]):
        """Send a batch of events to Mixpanel."""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._send_batch_sync, events)
            logger.debug(f"📊 Sent {len(events)} events to Mixpanel")
        except Exception as e:
            logger.error(f"❌ Failed to send analytics batch: {e}")

    def _send_batch_sync(self, events: List[Dict[str, Any]]):
        """Synchronous batch send (runs in executor)."""
        if not self.mixpanel:
            return

        for event in events:
            try:
                self.mixpanel.track(
                    distinct_id=event["distinct_id"],
                    event_name=event["event_name"],
                    properties=event["properties"]
                )
            except Exception as e:
                logger.error(f"❌ Failed to send event {event['event_name']}: {e}")

    def track_event(
        self,
        user: User,
        event_name: str,
        properties: Optional[Dict[str, Any]] = None
    ):
        """
        Track an analytics event (non-blocking).

        Args:
            user: Current authenticated user
            event_name: Event name (use constants from analytics_events.py)
            properties: Additional event properties
        """
        if not self.enabled and not self.mock_mode:
            return

        try:
            # Build event payload
            event = {
                "distinct_id": user.firebase_uid,
                "event_name": event_name,
                "properties": self._build_properties(user, properties or {})
            }

            # Queue event (non-blocking)
            if self.event_queue:
                try:
                    self.event_queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(f"⚠️ Analytics queue full, dropping event: {event_name}")

        except Exception as e:
            logger.error(f"❌ Failed to track event {event_name}: {e}")

    def _build_properties(
        self,
        user: User,
        properties: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build standard properties for all events."""
        base_properties = {
            # Standard Mixpanel properties
            "$email": user.email,
            "$name": getattr(user, 'name', user.email),
            "user_id": str(user.id),
            "firebase_uid": user.firebase_uid,
            "timestamp": datetime.utcnow().isoformat(),

            # Environment
            "environment": os.getenv("ENVIRONMENT", "production"),
        }

        # Merge with event-specific properties
        base_properties.update(properties)
        return base_properties

    def identify_user(self, user: User):
        """
        Set user properties in Mixpanel (called on login or profile update).
        """
        if not self.enabled and not self.mock_mode:
            return

        try:
            user_properties = {
                "$email": user.email,
                "$name": getattr(user, 'name', user.email),
                "firebase_uid": user.firebase_uid,
            }

            if self.mock_mode:
                logger.debug(f"🧪 [MOCK] Identified user: {user.email}")
            elif self.mixpanel:
                # Run in executor to avoid blocking
                loop = asyncio.get_event_loop()
                loop.run_in_executor(
                    None,
                    self.mixpanel.people_set,
                    user.firebase_uid,
                    user_properties
                )
                logger.debug(f"👤 Identified user: {user.email}")
        except Exception as e:
            logger.error(f"❌ Failed to identify user: {e}")


# Singleton instance
_analytics_service: Optional[AnalyticsService] = None


def get_analytics_service() -> AnalyticsService:
    """Get the global analytics service instance."""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = AnalyticsService(
            api_key=getattr(settings, 'mixpanel_api_key', None),
            enabled=getattr(settings, 'mixpanel_enabled', True),
            mock_mode=getattr(settings, 'mixpanel_mock_mode', False)
        )
    return _analytics_service
