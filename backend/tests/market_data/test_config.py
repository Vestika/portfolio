"""Configuration validation tests."""

import os
from unittest.mock import patch

import pytest

from services.market_data.config import MarketDataConfig, RateLimitConfig


class TestRateLimitConfig:
    def test_effective_rate_from_per_second(self):
        cfg = RateLimitConfig(requests_per_second=20.0)
        assert cfg.effective_rate_per_second() == 20.0

    def test_effective_rate_from_per_minute(self):
        cfg = RateLimitConfig(requests_per_minute=60.0)
        assert cfg.effective_rate_per_second() == pytest.approx(1.0)

    def test_neither_set_raises(self):
        cfg = RateLimitConfig()
        with pytest.raises(ValueError, match="Must set"):
            cfg.effective_rate_per_second()

    def test_both_set_raises(self):
        with pytest.raises(ValueError, match="not both"):
            RateLimitConfig(requests_per_second=1.0, requests_per_minute=60.0)


class TestMarketDataConfig:
    def test_default_config(self):
        cfg = MarketDataConfig()
        assert cfg.retention_days == 365
        assert cfg.max_concurrent_fetches == 5
        assert cfg.max_retries == 3
        assert "yahoo" in cfg.rate_limits
        assert "tase" in cfg.rate_limits

    def test_custom_config(self):
        cfg = MarketDataConfig(retention_days=30, max_concurrent_fetches=10)
        assert cfg.retention_days == 30
        assert cfg.max_concurrent_fetches == 10

    def test_config_from_env(self):
        with patch.dict(os.environ, {"MONGODB_URL": "mongodb://test:27017", "MONGODB_DATABASE": "test_db"}):
            cfg = MarketDataConfig()
            assert cfg.mongodb_url == "mongodb://test:27017"
            assert cfg.mongodb_database == "test_db"

    def test_invalid_config_raises(self):
        with pytest.raises(ValueError):
            MarketDataConfig(retention_days=0)
        with pytest.raises(ValueError):
            MarketDataConfig(max_concurrent_fetches=0)
        with pytest.raises(ValueError):
            MarketDataConfig(max_retries=-1)
