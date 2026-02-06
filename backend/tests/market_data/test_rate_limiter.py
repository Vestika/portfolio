"""TokenBucketRateLimiter unit tests."""

import asyncio
import time

import pytest

from services.market_data.config import RateLimitConfig
from services.market_data.writer.rate_limiter import TokenBucketRateLimiter


class TestTokenBucketRateLimiter:
    async def test_acquire_immediate_when_tokens_available(self):
        limiter = TokenBucketRateLimiter(RateLimitConfig(requests_per_second=10.0, burst_size=5))
        start = time.monotonic()
        await limiter.acquire()
        elapsed = time.monotonic() - start
        assert elapsed < 0.1  # Should be near-instant

    async def test_acquire_blocks_when_empty(self):
        limiter = TokenBucketRateLimiter(RateLimitConfig(requests_per_second=10.0, burst_size=1))
        await limiter.acquire()  # Drain the single token
        start = time.monotonic()
        await limiter.acquire()  # Must wait for refill
        elapsed = time.monotonic() - start
        assert elapsed >= 0.05  # Should wait ~0.1s for 1 token at 10/s

    async def test_refill_rate(self):
        limiter = TokenBucketRateLimiter(RateLimitConfig(requests_per_second=10.0, burst_size=1))
        await limiter.acquire()  # Drain
        await asyncio.sleep(0.15)  # Wait for ~1.5 tokens to refill
        start = time.monotonic()
        await limiter.acquire()  # Should be available now
        elapsed = time.monotonic() - start
        assert elapsed < 0.05

    async def test_burst_cap(self):
        limiter = TokenBucketRateLimiter(RateLimitConfig(requests_per_second=100.0, burst_size=3))
        await asyncio.sleep(0.1)  # Would refill 10 tokens but capped at burst=3
        # Should be able to acquire 3 instantly
        for _ in range(3):
            start = time.monotonic()
            await limiter.acquire()
            assert time.monotonic() - start < 0.05

    async def test_report_rejection_enters_cooldown(self):
        limiter = TokenBucketRateLimiter(
            RateLimitConfig(requests_per_second=100.0, burst_size=10, cooldown_seconds=0.2)
        )
        limiter.report_rejection()
        assert limiter.in_cooldown
        start = time.monotonic()
        await limiter.acquire()
        elapsed = time.monotonic() - start
        assert elapsed >= 0.15  # Should wait for cooldown (~0.2s)

    async def test_cooldown_expires(self):
        limiter = TokenBucketRateLimiter(
            RateLimitConfig(requests_per_second=100.0, burst_size=10, cooldown_seconds=0.1)
        )
        limiter.report_rejection()
        await asyncio.sleep(0.15)
        assert not limiter.in_cooldown
        start = time.monotonic()
        await limiter.acquire()
        assert time.monotonic() - start < 0.05

    def test_rate_from_per_minute(self):
        limiter = TokenBucketRateLimiter(RateLimitConfig(requests_per_minute=60.0))
        assert limiter.effective_rate == pytest.approx(1.0)

    def test_invalid_config_raises(self):
        with pytest.raises(ValueError):
            RateLimitConfig().effective_rate_per_second()

    async def test_concurrent_acquire(self):
        limiter = TokenBucketRateLimiter(
            RateLimitConfig(requests_per_second=50.0, burst_size=5)
        )
        # 5 concurrent acquires should succeed (burst = 5)
        start = time.monotonic()
        await asyncio.gather(*[limiter.acquire() for _ in range(5)])
        elapsed = time.monotonic() - start
        assert elapsed < 0.5  # All should complete within reasonable time
