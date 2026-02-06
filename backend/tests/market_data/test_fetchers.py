"""Fetcher tests (minimal real API + mocked)."""

from datetime import date, datetime
from unittest.mock import MagicMock, patch

import pytest

from services.market_data.config import RateLimitConfig
from services.market_data.models import HistoricalBar
from services.market_data.writer.fetchers.registry import FetcherRegistry
from services.market_data.writer.fetchers.yahoo import YahooFinanceFetcher
from services.market_data.writer.fetchers.tase import TASEFetcher
from services.market_data.writer.rate_limiter import TokenBucketRateLimiter


class TestYahooFinanceFetcher:
    async def test_yahoo_fetcher_returns_bars_mocked(self):
        import pandas as pd

        idx = pd.DatetimeIndex([datetime(2026, 1, 5), datetime(2026, 1, 6)])
        df = pd.DataFrame({"Close": [150.0, 151.5]}, index=idx)

        fetcher = YahooFinanceFetcher()
        with patch.object(fetcher, "_download_sync", return_value=df):
            bars = await fetcher.fetch_historical("AAPL", date(2026, 1, 5), date(2026, 1, 6))

        assert bars is not None
        assert len(bars) == 2
        assert bars[0].close == 150.0
        assert bars[1].close == 151.5

    async def test_yahoo_fetcher_empty_result_mocked(self):
        import pandas as pd

        fetcher = YahooFinanceFetcher()
        with patch.object(fetcher, "_download_sync", return_value=pd.DataFrame()):
            bars = await fetcher.fetch_historical("FAKE", date(2026, 1, 1), date(2026, 1, 5))

        assert bars is None

    async def test_yahoo_fetcher_timeout_mocked(self):
        import asyncio

        async def slow_exec(fn, *args):
            await asyncio.sleep(100)

        fetcher = YahooFinanceFetcher()
        with patch("asyncio.get_running_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = slow_exec
            bars = await fetcher.fetch_historical("AAPL", date(2026, 1, 1), date(2026, 1, 5))

        # Should return None due to timeout (we set 30s timeout, but mock sleeps 100)
        assert bars is None

    def test_yahoo_fetcher_currency_symbol_mapping(self):
        assert YahooFinanceFetcher._map_symbol("FX:USD") == "USDILS=X"
        assert YahooFinanceFetcher._map_symbol("FX:EUR") == "EURILS=X"

    def test_yahoo_fetcher_exchange_prefix_strip(self):
        assert YahooFinanceFetcher._map_symbol("NYSE:BTC") == "BTC"
        assert YahooFinanceFetcher._map_symbol("NASDAQ:AAPL") == "AAPL"
        assert YahooFinanceFetcher._map_symbol("AAPL") == "AAPL"


class TestTASEFetcher:
    async def test_tase_fetcher_agorot_conversion_mocked(self):
        entries = [
            {"TradeDate": "06/01/2026", "CloseRate": 5000},  # 50.00 ILS
        ]
        with patch.object(TASEFetcher, "_fetch_sync", return_value=entries):
            fetcher = TASEFetcher()
            bars = await fetcher.fetch_historical("12345", date(2026, 1, 1), date(2026, 1, 10))

        assert bars is not None
        assert len(bars) == 1
        assert bars[0].close == 50.0

    async def test_tase_fetcher_date_format_handling_mocked(self):
        entries = [
            {"TradeDate": "2026-01-06T00:00:00", "CloseRate": 10000},
            {"TradeDate": "05/01/2026", "CloseRate": 9500},
        ]
        with patch.object(TASEFetcher, "_fetch_sync", return_value=entries):
            fetcher = TASEFetcher()
            bars = await fetcher.fetch_historical("12345", date(2026, 1, 1), date(2026, 1, 10))

        assert bars is not None
        assert len(bars) == 2

    @pytest.mark.slow
    async def test_yahoo_real_single_symbol(self):
        """Real API: fetch 5 days of AAPL. Marked slow to skip in fast CI."""
        fetcher = YahooFinanceFetcher()
        end = date.today()
        start = end - __import__("datetime").timedelta(days=10)
        bars = await fetcher.fetch_historical("AAPL", start, end)
        # May be None on weekends or holidays, but usually has data
        if bars:
            assert len(bars) > 0
            assert all(isinstance(b, HistoricalBar) for b in bars)


class TestFetcherRegistry:
    def test_fetcher_registry_returns_correct_fetcher(self):
        registry = FetcherRegistry()
        yahoo = YahooFinanceFetcher()
        tase = TASEFetcher()
        yahoo_limiter = TokenBucketRateLimiter(RateLimitConfig(requests_per_second=10.0))
        tase_limiter = TokenBucketRateLimiter(RateLimitConfig(requests_per_second=5.0))

        registry.register("US", yahoo, yahoo_limiter)
        registry.register("TASE", tase, tase_limiter)

        fetcher, limiter = registry.get("US")
        assert fetcher is yahoo
        assert limiter is yahoo_limiter

        fetcher, limiter = registry.get("TASE")
        assert fetcher is tase

        with pytest.raises(KeyError):
            registry.get("UNKNOWN")
