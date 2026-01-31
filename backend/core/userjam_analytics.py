"""
Userjam analytics service for tracking user events and behavior.

Features:
- Non-blocking async event queue
- Background worker with batching
- Graceful error handling
- User identification (traits)
- Event tracking with rich properties
- Proper event naming conventions (category.action_past_tense)
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
import os
import httpx

from config import settings
from models.user_model import User

logger = logging.getLogger(__name__)


class UserjamAnalyticsService:
    """
    Centralized analytics service for tracking user events in Userjam.

    Architecture:
    - Events are queued immediately (non-blocking)
    - Background worker processes queue in batches
    - Failures are logged but don't affect user operations

    Usage:
        userjam = get_userjam_service()
        userjam.track_event(
            user=current_user,
            event_name="portfolio.created",
            properties={"portfolio_id": "123", "base_currency": "USD"}
        )
    """

    USERJAM_ENDPOINT = "https://api.userjam.com/api/report"

    def __init__(
        self,
        api_key: Optional[str] = None,
        enabled: bool = True
    ):
        self.api_key = api_key or getattr(settings, 'userjam_api_key', None) or ""
        self.enabled = enabled and bool(self.api_key)

        # Event queue and worker
        self.event_queue: Optional[asyncio.Queue] = None
        self.worker_task: Optional[asyncio.Task] = None
        self.shutdown_flag = asyncio.Event()

        # HTTP client for API calls
        self.http_client: Optional[httpx.AsyncClient] = None

        if self.enabled:
            logger.info("✅ Userjam analytics initialized")
        else:
            logger.warning("⚠️ Userjam analytics disabled (no API key)")

    async def start(self):
        """Start the background worker. Called on app startup."""
        if not self.enabled:
            return

        # Initialize HTTP client
        self.http_client = httpx.AsyncClient(timeout=10.0)

        self.event_queue = asyncio.Queue(maxsize=10000)
        self.shutdown_flag.clear()
        self.worker_task = asyncio.create_task(self._background_worker())
        logger.info("🚀 Userjam background worker started")

    async def stop(self):
        """Stop the background worker gracefully. Called on app shutdown."""
        if self.worker_task:
            self.shutdown_flag.set()

            # Wait for worker to finish processing remaining events (with timeout)
            try:
                await asyncio.wait_for(self.worker_task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("⚠️ Userjam worker shutdown timeout, cancelling")
                self.worker_task.cancel()
                try:
                    await self.worker_task
                except asyncio.CancelledError:
                    pass

            logger.info("🛑 Userjam background worker stopped")

        # Close HTTP client
        if self.http_client:
            await self.http_client.aclose()

    async def _background_worker(self):
        """
        Background worker that processes events from queue and sends to Userjam.
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

                # Send batch to Userjam
                await self._send_batch(events_batch)

            except Exception as e:
                logger.error(f"❌ Userjam worker error: {e}", exc_info=True)
                await asyncio.sleep(1)  # Brief pause on error

    async def _send_batch(self, events: List[Dict[str, Any]]):
        """Send a batch of events to Userjam."""
        if not self.http_client:
            return

        for event in events:
            try:
                response = await self.http_client.post(
                    self.USERJAM_ENDPOINT,
                    json=event,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                )
                response.raise_for_status()
            except Exception as e:
                logger.error(f"❌ Failed to send Userjam event {event.get('event', 'unknown')}: {e}")

        logger.debug(f"📊 Sent {len(events)} events to Userjam")

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
            event_name: Event name in format "category.action_past_tense" (e.g., "portfolio.created")
            properties: Additional event properties (rich metadata encouraged)
        """
        if not self.enabled:
            return

        try:
            # Build event payload (Userjam track format)
            event = {
                "type": "track",
                "userId": user.firebase_uid,
                "event": event_name,
                "properties": properties or {},
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }

            # Queue event (non-blocking)
            if self.event_queue:
                try:
                    self.event_queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(f"⚠️ Userjam queue full, dropping event: {event_name}")

        except Exception as e:
            logger.error(f"❌ Failed to track Userjam event {event_name}: {e}")

    def identify_user(self, user: User, additional_traits: Optional[Dict[str, Any]] = None):
        """
        Identify a user and set their traits in Userjam.
        Call on signup, login, or profile update.

        Args:
            user: Current authenticated user
            additional_traits: Additional user traits beyond standard ones
        """
        if not self.enabled:
            return

        try:
            # Build traits payload
            traits = {
                "name": getattr(user, 'name', user.email),
                "email": user.email,
                "created_at": user.created_at.isoformat() + "Z" if hasattr(user, 'created_at') and user.created_at else datetime.utcnow().isoformat() + "Z",
            }

            # Add additional traits if provided
            if additional_traits:
                traits.update(additional_traits)

            # Build identify payload (Userjam identify format)
            event = {
                "type": "identify",
                "userId": user.firebase_uid,
                "traits": traits
            }

            # Queue event (non-blocking)
            if self.event_queue:
                try:
                    self.event_queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(f"⚠️ Userjam queue full, dropping identify for user: {user.email}")

            logger.debug(f"👤 Identified user in Userjam: {user.email}")

        except Exception as e:
            logger.error(f"❌ Failed to identify user in Userjam: {e}")

    def track_error(
        self,
        user: Optional[User],
        error: Exception,
        context: Optional[Dict[str, Any]] = None
    ):
        """
        Track an error event in Userjam.

        Args:
            user: Current authenticated user (if available)
            error: The exception that occurred
            context: Additional context about the error (request details, etc.)
        """
        if not self.enabled or not user:
            return

        try:
            properties = {
                "error_type": type(error).__name__,
                "message": str(error),
                "traceback": str(error.__traceback__) if hasattr(error, '__traceback__') else None,
            }

            # Add context if provided
            if context:
                properties.update(context)

            self.track_event(
                user=user,
                event_name="error.api_error",
                properties=properties
            )

        except Exception as e:
            logger.error(f"❌ Failed to track error in Userjam: {e}")


# Singleton instance
_userjam_service: Optional[UserjamAnalyticsService] = None


def get_userjam_service() -> UserjamAnalyticsService:
    """Get the global Userjam analytics service instance."""
    global _userjam_service
    if _userjam_service is None:
        _userjam_service = UserjamAnalyticsService(
            api_key=getattr(settings, 'userjam_api_key', None),
            enabled=True
        )
    return _userjam_service
