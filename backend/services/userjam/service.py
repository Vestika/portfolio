"""
Userjam Analytics Service

Provides tracking and identification functions for Userjam analytics.
Events follow the naming convention: category.action_past_tense

Backend events track core business logic:
- user.signed_up, user.identified
- portfolio.created, portfolio.updated, portfolio.deleted
- holding.added, holding.removed
- tag.created, tag.applied
- ai_chat.message_sent, ai_chat.response_received
- ibkr.import_started, ibkr.import_completed
- error.api_error
"""

import os
import logging
from typing import Any, Dict, Optional
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)

USERJAM_ENDPOINT = "https://api.userjam.com/api/report"
API_KEY = os.environ.get("USERJAM_API_KEY")

# Async client for non-blocking requests
_client: Optional[httpx.AsyncClient] = None


def get_client() -> httpx.AsyncClient:
    """Get or create async HTTP client."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=2.0)
    return _client


async def close_client():
    """Close the async HTTP client."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def track(
    user_id: str,
    event: str,
    properties: Optional[Dict[str, Any]] = None,
    timestamp: Optional[str] = None
) -> None:
    """
    Track a user event asynchronously.

    Args:
        user_id: Unique user identifier (Firebase UID)
        event: Event name in format 'category.action_past_tense'
        properties: Optional event properties/metadata
        timestamp: Optional ISO 8601 timestamp (defaults to now)

    Example:
        await track(
            user_id="firebase_uid_123",
            event="portfolio.created",
            properties={
                "portfolio_id": "port_123",
                "portfolio_name": "My 401k",
                "base_currency": "USD",
                "account_count": 1
            }
        )
    """
    if not API_KEY:
        logger.debug("Userjam: No API Key found, skipping event: %s", event)
        return

    payload = {
        "type": "track",
        "userId": user_id,
        "event": event,
        "properties": properties or {},
        "timestamp": timestamp or datetime.utcnow().isoformat() + "Z"
    }

    try:
        client = get_client()
        # Fire and forget - don't await to avoid blocking
        response = await client.post(
            USERJAM_ENDPOINT,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        if response.status_code >= 400:
            logger.warning(
                "Userjam track failed: %s - %s",
                response.status_code,
                response.text
            )
    except Exception as e:
        logger.error("Userjam track error for event '%s': %s", event, e)


async def identify(
    user_id: str,
    traits: Dict[str, Any]
) -> None:
    """
    Identify a user with traits.

    Call this on signup, login, and profile updates.

    Required traits for proper analytics:
    - name: User's full name
    - email: User's email
    - created_at: ISO 8601 timestamp of user signup

    Optional but recommended traits:
    - account_id: Organization/company ID
    - plan: Subscription plan name
    - any custom traits relevant to your app

    Args:
        user_id: Unique user identifier (Firebase UID)
        traits: User traits/properties

    Example:
        await identify(
            user_id="firebase_uid_123",
            traits={
                "name": "Jane Doe",
                "email": "jane@example.com",
                "created_at": "2023-01-15T08:30:00Z",
                "plan": "free",
                "portfolio_count": 3
            }
        )
    """
    if not API_KEY:
        logger.debug("Userjam: No API Key found, skipping identify for user: %s", user_id)
        return

    payload = {
        "type": "identify",
        "userId": user_id,
        "traits": traits
    }

    try:
        client = get_client()
        response = await client.post(
            USERJAM_ENDPOINT,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        if response.status_code >= 400:
            logger.warning(
                "Userjam identify failed: %s - %s",
                response.status_code,
                response.text
            )
    except Exception as e:
        logger.error("Userjam identify error for user '%s': %s", user_id, e)


def track_server(
    user_id: str,
    event: str,
    properties: Optional[Dict[str, Any]] = None
) -> None:
    """
    Synchronous wrapper for track() - for use in non-async contexts.

    This is a fire-and-forget wrapper that schedules the async track call.
    Use the async track() function directly when possible.

    Args:
        user_id: Unique user identifier
        event: Event name in format 'category.action_past_tense'
        properties: Optional event properties
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Schedule as a task without awaiting
            asyncio.create_task(track(user_id, event, properties))
        else:
            # Run in new event loop if no loop is running
            asyncio.run(track(user_id, event, properties))
    except Exception as e:
        logger.error("Failed to schedule tracking for event '%s': %s", event, e)
