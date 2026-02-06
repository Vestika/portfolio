"""Fetcher registry -- maps market type to fetcher + rate limiter."""

from __future__ import annotations

from .protocol import PriceFetcher
from ..rate_limiter import TokenBucketRateLimiter


class FetcherRegistry:
    """Maps market types to their fetcher + rate limiter.

    Usage::

        registry = FetcherRegistry()
        registry.register("US", yahoo_fetcher, yahoo_limiter)
        fetcher, limiter = registry.get("US")
    """

    def __init__(self) -> None:
        self._registry: dict[str, tuple[PriceFetcher, TokenBucketRateLimiter]] = {}

    def register(
        self,
        market: str,
        fetcher: PriceFetcher,
        rate_limiter: TokenBucketRateLimiter,
    ) -> None:
        self._registry[market] = (fetcher, rate_limiter)

    def get(self, market: str) -> tuple[PriceFetcher, TokenBucketRateLimiter]:
        try:
            return self._registry[market]
        except KeyError:
            raise KeyError(f"No fetcher registered for market '{market}'") from None

    @property
    def markets(self) -> set[str]:
        return set(self._registry.keys())
