"""Token bucket rate limiter with cooldown support."""

from __future__ import annotations

import asyncio
import time

from ..config import RateLimitConfig


class TokenBucketRateLimiter:
    """Token bucket rate limiter for controlling API request pace.

    Tokens refill at a fixed rate (derived from ``requests_per_second`` or
    ``requests_per_minute``), up to ``burst_size`` capacity.  On rejection,
    enters a cooldown period where no tokens are dispensed.

    No adaptive penalty/recovery -- rate stays constant.
    """

    def __init__(self, config: RateLimitConfig) -> None:
        self._rate = config.effective_rate_per_second()
        self._burst = config.burst_size
        self._tokens = float(config.burst_size)
        self._cooldown_seconds = config.cooldown_seconds
        self._last_refill = time.monotonic()
        self._cooldown_until: float = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self, count: int = 1) -> None:
        """Wait until *count* tokens are available.  Respects cooldown."""
        while True:
            async with self._lock:
                now = time.monotonic()

                # Respect cooldown
                if now < self._cooldown_until:
                    wait = self._cooldown_until - now
                else:
                    # Refill tokens
                    elapsed = now - self._last_refill
                    self._tokens = min(self._burst, self._tokens + elapsed * self._rate)
                    self._last_refill = now

                    if self._tokens >= count:
                        self._tokens -= count
                        return

                    # Not enough tokens -- compute wait time
                    deficit = count - self._tokens
                    wait = deficit / self._rate

            await asyncio.sleep(wait)

    def report_success(self) -> None:
        """No-op for simple limiter (no adaptive behavior)."""

    def report_rejection(self) -> None:
        """Enter cooldown -- no tokens dispensed for ``cooldown_seconds``."""
        self._cooldown_until = time.monotonic() + self._cooldown_seconds

    @property
    def effective_rate(self) -> float:
        """The configured rate (constant, not adaptive)."""
        return self._rate

    @property
    def in_cooldown(self) -> bool:
        """True if currently in cooldown period."""
        return time.monotonic() < self._cooldown_until
