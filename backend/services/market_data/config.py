"""Market data service configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class RateLimitConfig:
    """Rate limit configuration for a specific API.

    Supports both per-second and per-minute limits. Internally normalized to
    a token bucket: tokens refill at the configured rate, up to burst capacity.
    On rejection (429 response), the limiter pauses for cooldown_seconds before
    resuming at the same configured rate.
    """

    requests_per_second: float | None = None
    requests_per_minute: float | None = None
    burst_size: int = 1
    cooldown_seconds: float = 5.0

    def __post_init__(self) -> None:
        if self.requests_per_second is not None and self.requests_per_minute is not None:
            raise ValueError("Set requests_per_second or requests_per_minute, not both")
        if self.burst_size < 1:
            raise ValueError("burst_size must be >= 1")
        if self.cooldown_seconds < 0:
            raise ValueError("cooldown_seconds must be >= 0")

    def effective_rate_per_second(self) -> float:
        """Normalize to tokens/sec regardless of how the limit was specified."""
        if self.requests_per_second is not None:
            if self.requests_per_second <= 0:
                raise ValueError("requests_per_second must be > 0")
            return self.requests_per_second
        if self.requests_per_minute is not None:
            if self.requests_per_minute <= 0:
                raise ValueError("requests_per_minute must be > 0")
            return self.requests_per_minute / 60.0
        raise ValueError("Must set requests_per_second or requests_per_minute")


@dataclass
class MarketDataConfig:
    """Configuration for the market data service."""

    # Reader
    retention_days: int = 365
    ram_cleanup_hour: int = 3  # UTC

    # Writer
    mongo_expire_after_seconds: int = 365 * 86400
    backfill_interval_hours: int = 24
    backfill_staleness_days: int = 3

    # Per-API rate limits
    rate_limits: dict[str, RateLimitConfig] = field(default_factory=lambda: {
        "yahoo": RateLimitConfig(requests_per_second=2.0, burst_size=2, cooldown_seconds=5.0),
        "tase": RateLimitConfig(requests_per_second=1.0, burst_size=1, cooldown_seconds=3.0),
    })

    # Work queue
    max_concurrent_fetches: int = 5
    retry_delay_seconds: float = 3.0
    max_retries: int = 3

    # MongoDB
    mongodb_url: str = ""
    mongodb_database: str = ""
    timeseries_collection: str = "market_data_prices"

    def __post_init__(self) -> None:
        if self.retention_days < 1:
            raise ValueError("retention_days must be >= 1")
        if self.max_concurrent_fetches < 1:
            raise ValueError("max_concurrent_fetches must be >= 1")
        if self.max_retries < 0:
            raise ValueError("max_retries must be >= 0")
        if self.retry_delay_seconds < 0:
            raise ValueError("retry_delay_seconds must be >= 0")

        # Fill from environment if not explicitly set
        if not self.mongodb_url:
            self.mongodb_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
        if not self.mongodb_database:
            self.mongodb_database = os.environ.get("MONGODB_DATABASE", "vestika")
