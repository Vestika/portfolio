import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, date
import httpx

from app.services.stock_fetcher import FinnhubFetcher, TaseFetcher, StockFetcherFactory
from app.services.price_manager import PriceManager
from app.models import StockPrice, TrackedSymbol


class TestStockFetchers:
    """Test suite for stock price fetchers"""

    def test_stock_fetcher_factory_us_symbol(self):
        """Test factory creates Finnhub fetcher for US symbols"""
        fetcher = StockFetcherFactory.create_fetcher("AAPL")
        assert isinstance(fetcher, FinnhubFetcher)
        assert StockFetcherFactory.get_market_type("AAPL") == "US"

    def test_stock_fetcher_factory_tase_symbol(self):
        """Test factory creates TASE fetcher for numeric symbols"""
        fetcher = StockFetcherFactory.create_fetcher("1101534")
        assert isinstance(fetcher, TaseFetcher)
        assert StockFetcherFactory.get_market_type("1101534") == "TASE"

    @pytest.mark.asyncio
    async def test_finnhub_fetcher_success(self):
        """Test successful Finnhub API call"""
        fetcher = FinnhubFetcher()
        fetcher.api_key = "test_key"
        
        mock_response_quote = MagicMock()
        mock_response_quote.status_code = 200
        mock_response_quote.json.return_value = {"c": 150.25}
        mock_response_quote.raise_for_status.return_value = None
        
        mock_response_profile = MagicMock()
        mock_response_profile.status_code = 200
        mock_response_profile.json.return_value = {"currency": "USD"}
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = [
                mock_response_quote,
                mock_response_profile
            ]
            
            result = await fetcher.fetch_price("AAPL")
            
            assert result is not None
            assert result["symbol"] == "AAPL"
            assert result["price"] == 150.25
            assert result["currency"] == "USD"
            assert result["market"] == "US"
            assert result["date"] == date.today().isoformat()

    @pytest.mark.asyncio
    async def test_finnhub_fetcher_no_api_key(self):
        """Test Finnhub fetcher with no API key"""
        fetcher = FinnhubFetcher()
        fetcher.api_key = ""
        
        result = await fetcher.fetch_price("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_finnhub_fetcher_api_error(self):
        """Test Finnhub fetcher with API error"""
        fetcher = FinnhubFetcher()
        fetcher.api_key = "test_key"
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = httpx.HTTPError("API Error")
            
            result = await fetcher.fetch_price("AAPL")
            assert result is None

    @pytest.mark.asyncio
    async def test_tase_fetcher_success(self):
        """Test successful TASE price fetch"""
        fetcher = TaseFetcher()
        
        mock_securities = [
            {
                "Id": "1101534",
                "Name": "Test Security",
                "Price": 1234.56
            }
        ]
        
        with patch('app.services.stock_fetcher.Maya') as mock_maya_class:
            mock_maya_instance = mock_maya_class.return_value
            mock_maya_instance.get_all_securities.return_value = mock_securities
            
            result = await fetcher.fetch_price("1101534")
            
            assert result is not None
            assert result["symbol"] == "1101534"
            assert result["price"] == 1234.56
            assert result["currency"] == "ILS"
            assert result["market"] == "TASE"
            assert result["date"] == date.today().isoformat()

    @pytest.mark.asyncio
    async def test_tase_fetcher_invalid_symbol(self):
        """Test TASE fetcher with invalid symbol"""
        fetcher = TaseFetcher()
        
        result = await fetcher.fetch_price("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_tase_fetcher_no_data(self):
        """Test TASE fetcher when no data returned"""
        fetcher = TaseFetcher()
        
        mock_securities = [
            {
                "Id": "9999999",  # Different ID, not matching our search
                "Name": "Other Security",
                "Price": 999.99
            }
        ]
        
        with patch('app.services.stock_fetcher.Maya') as mock_maya_class:
            mock_maya_instance = mock_maya_class.return_value
            mock_maya_instance.get_all_securities.return_value = mock_securities
            
            result = await fetcher.fetch_price("1101534")
            assert result is None


class TestPriceManager:
    """Test suite for PriceManager"""

    @pytest.fixture
    def price_manager(self):
        """Create PriceManager instance for testing"""
        return PriceManager()

    @pytest.fixture
    def sample_stock_price(self):
        """Create sample StockPrice for testing"""
        return StockPrice(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            market="US",
            fetched_at=datetime.utcnow(),
            date=date.today().isoformat()
        )

    @pytest.mark.asyncio
    async def test_get_price_from_cache(self, price_manager):
        """Test getting price from cache"""
        with patch.object(price_manager, '_get_cached_price') as mock_cache:
            mock_cache.return_value = MagicMock(symbol="AAPL", price=150.25)
            
            with patch.object(price_manager, '_update_tracking') as mock_update:
                result = await price_manager.get_price("AAPL")
                
                assert result is not None
                mock_cache.assert_called_once_with("AAPL")
                mock_update.assert_called_once_with("AAPL")

    @pytest.mark.asyncio
    async def test_get_price_from_db(self, price_manager, sample_stock_price):
        """Test getting price from database when cache miss"""
        with patch.object(price_manager, '_get_cached_price', return_value=None):
            with patch.object(price_manager, '_get_db_price', return_value=sample_stock_price):
                with patch.object(price_manager, '_is_price_fresh', return_value=True):
                    with patch.object(price_manager, '_cache_price') as mock_cache:
                        with patch.object(price_manager, '_update_tracking') as mock_update:
                            result = await price_manager.get_price("AAPL")
                            
                            assert result is not None
                            assert result.symbol == "AAPL"
                            mock_cache.assert_called_once()
                            mock_update.assert_called_once_with("AAPL")

    @pytest.mark.asyncio
    async def test_get_price_fetch_fresh(self, price_manager):
        """Test fetching fresh price when cache and DB miss"""
        mock_price_response = MagicMock(symbol="AAPL", price=150.25)
        
        with patch.object(price_manager, '_get_cached_price', return_value=None):
            with patch.object(price_manager, '_get_db_price', return_value=None):
                with patch.object(price_manager, '_fetch_and_store_price', return_value=mock_price_response):
                    with patch.object(price_manager, '_update_tracking') as mock_update:
                        result = await price_manager.get_price("AAPL")
                        
                        assert result is not None
                        assert result.symbol == "AAPL"
                        mock_update.assert_called_once_with("AAPL")

    @pytest.mark.asyncio
    async def test_track_symbols(self, price_manager):
        """Test tracking new symbols"""
        symbols = ["AAPL", "MSFT"]
        
        # Mock database operations
        with patch('app.database.db') as mock_db:
            mock_db.database.tracked_symbols.find_one.return_value = None
            mock_db.database.tracked_symbols.insert_one = AsyncMock()
            
            result = await price_manager.track_symbols(symbols)
            
            assert result["AAPL"] == "added"
            assert result["MSFT"] == "added"

    @pytest.mark.asyncio
    async def test_track_symbols_already_tracked(self, price_manager):
        """Test tracking symbols that are already tracked"""
        symbols = ["AAPL"]
        
        with patch('app.database.db') as mock_db:
            mock_db.database.tracked_symbols.find_one.return_value = {"symbol": "AAPL"}
            
            result = await price_manager.track_symbols(symbols)
            
            assert result["AAPL"] == "already_tracked"

    @pytest.mark.asyncio
    async def test_refresh_tracked_symbols(self, price_manager):
        """Test refreshing all tracked symbols"""
        mock_symbols = [
            {"symbol": "AAPL"},
            {"symbol": "MSFT"}
        ]
        
        mock_price_response = MagicMock(symbol="AAPL")
        
        with patch.object(price_manager, '_get_tracked_symbols', return_value=mock_symbols):
            with patch.object(price_manager, '_fetch_and_store_price', return_value=mock_price_response):
                with patch.object(price_manager, '_cleanup_old_tracked_symbols'):
                    result = await price_manager.refresh_tracked_symbols()
                    
                    assert result["refreshed_count"] == 2
                    assert result["not_refreshed_count"] == 0
                    assert len(result["failed_symbols"]) == 0
                    assert "Refreshed 2 symbols" in result["message"]

    @pytest.mark.asyncio
    async def test_refresh_tracked_symbols_with_not_refreshed(self, price_manager):
        """Test refreshing symbols where some have no new data"""
        mock_symbols = [
            {"symbol": "AAPL"},
            {"symbol": "MSFT"}
        ]
        
        mock_price_response = MagicMock(symbol="AAPL")
        
        def mock_fetch_side_effect(symbol):
            if symbol == "AAPL":
                return mock_price_response
            else:
                return None  # No new data for MSFT
        
        with patch.object(price_manager, '_get_tracked_symbols', return_value=mock_symbols):
            with patch.object(price_manager, '_fetch_and_store_price', side_effect=mock_fetch_side_effect):
                with patch.object(price_manager, '_cleanup_old_tracked_symbols'):
                    result = await price_manager.refresh_tracked_symbols()
                    
                    assert result["refreshed_count"] == 1
                    assert result["not_refreshed_count"] == 1
                    assert len(result["failed_symbols"]) == 0
                    assert "Refreshed 1 symbols, 1 not refreshed (no new data)" in result["message"]

    def test_is_price_fresh(self, price_manager):
        """Test price freshness check"""
        # Fresh price (recent)
        recent_time = datetime.utcnow()
        assert price_manager._is_price_fresh(recent_time) is True
        
        # Old price (more than cache TTL)
        from datetime import timedelta
        old_time = datetime.utcnow() - timedelta(seconds=86400 + 1)
        assert price_manager._is_price_fresh(old_time) is False

    def test_to_price_response(self, price_manager, sample_stock_price):
        """Test conversion from StockPrice to PriceResponse"""
        result = price_manager._to_price_response(sample_stock_price)
        
        assert result.symbol == sample_stock_price.symbol
        assert result.price == sample_stock_price.price
        assert result.currency == sample_stock_price.currency
        assert result.market == sample_stock_price.market
        assert result.date == sample_stock_price.date
        assert result.fetched_at == sample_stock_price.fetched_at 