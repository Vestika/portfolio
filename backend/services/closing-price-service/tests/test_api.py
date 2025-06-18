import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from datetime import datetime

from app.main import app
from app.models import PriceResponse


client = TestClient(app)


class TestAPI:
    """Test suite for API endpoints"""

    def test_root_endpoint(self):
        """Test the root endpoint returns service information"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Closing Price Service"
        assert data["status"] == "running"
        assert "version" in data

    def test_health_endpoint(self):
        """Test the health check endpoint"""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "closing-price-service"

    @patch('app.services.price_manager.PriceManager.get_price')
    def test_get_price_success(self, mock_get_price):
        """Test successful price retrieval"""
        mock_price = PriceResponse(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            market="US",
            date="2024-01-15",
            fetched_at=datetime.utcnow()
        )
        mock_get_price.return_value = mock_price

        response = client.get("/api/v1/prices/AAPL")
        assert response.status_code == 200
        data = response.json()
        assert data["symbol"] == "AAPL"
        assert data["price"] == 150.25
        assert data["currency"] == "USD"
        assert data["market"] == "US"

    @patch('app.services.price_manager.PriceManager.get_price')
    def test_get_price_not_found(self, mock_get_price):
        """Test price retrieval when symbol not found"""
        mock_get_price.return_value = None

        response = client.get("/api/v1/prices/INVALID")
        assert response.status_code == 404
        assert "Could not fetch price" in response.json()["detail"]

    @patch('app.services.price_manager.PriceManager.get_tracked_prices')
    def test_get_tracked_prices(self, mock_get_tracked_prices):
        """Test getting all tracked prices"""
        mock_prices = [
            PriceResponse(
                symbol="AAPL",
                price=150.25,
                currency="USD",
                market="US",
                date="2024-01-15",
                fetched_at=datetime.utcnow()
            ),
            PriceResponse(
                symbol="1101534",
                price=1234.56,
                currency="ILS",
                market="TASE",
                date="2024-01-15",
                fetched_at=datetime.utcnow()
            )
        ]
        mock_get_tracked_prices.return_value = mock_prices

        response = client.get("/api/v1/prices")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["symbol"] == "AAPL"
        assert data[1]["symbol"] == "1101534"

    @patch('app.services.price_manager.PriceManager.track_symbols')
    def test_track_symbols_success(self, mock_track_symbols):
        """Test successful symbol tracking"""
        mock_track_symbols.return_value = {
            "AAPL": "added",
            "MSFT": "already_tracked"
        }

        response = client.post(
            "/api/v1/prices",
            json={"symbols": ["AAPL", "MSFT"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["AAPL"] == "added"
        assert data["MSFT"] == "already_tracked"

    def test_track_symbols_empty_list(self):
        """Test tracking with empty symbol list"""
        response = client.post(
            "/api/v1/prices",
            json={"symbols": []}
        )
        assert response.status_code == 400
        assert "No symbols provided" in response.json()["detail"]

    def test_track_symbols_invalid_payload(self):
        """Test tracking with invalid payload"""
        response = client.post(
            "/api/v1/prices",
            json={"invalid": "payload"}
        )
        assert response.status_code == 422

    @patch('app.services.price_manager.PriceManager.refresh_tracked_symbols')
    def test_refresh_prices_success(self, mock_refresh):
        """Test successful price refresh"""
        mock_refresh.return_value = {
            "message": "Refreshed 2 symbols",
            "refreshed_count": 2,
            "not_refreshed_count": 0,
            "failed_symbols": []
        }

        response = client.post("/api/v1/prices/refresh")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Refreshed 2 symbols"
        assert data["refreshed_count"] == 2
        assert data["not_refreshed_count"] == 0
        assert data["failed_symbols"] == []

    @patch('app.services.price_manager.PriceManager.refresh_tracked_symbols')
    def test_refresh_prices_with_failures(self, mock_refresh):
        """Test price refresh with some failures"""
        mock_refresh.return_value = {
            "message": "Refreshed 1 symbols, 1 failed",
            "refreshed_count": 1,
            "not_refreshed_count": 0,
            "failed_symbols": ["INVALID"]
        }

        response = client.post("/api/v1/prices/refresh")
        assert response.status_code == 200
        data = response.json()
        assert data["refreshed_count"] == 1
        assert data["not_refreshed_count"] == 0
        assert "INVALID" in data["failed_symbols"]

    @patch('app.services.price_manager.PriceManager.refresh_tracked_symbols')
    def test_refresh_prices_with_not_refreshed(self, mock_refresh):
        """Test price refresh with some symbols not refreshed due to no new data"""
        mock_refresh.return_value = {
            "message": "Refreshed 1 symbols, 1 not refreshed (no new data)",
            "refreshed_count": 1,
            "not_refreshed_count": 1,
            "failed_symbols": []
        }

        response = client.post("/api/v1/prices/refresh")
        assert response.status_code == 200
        data = response.json()
        assert data["refreshed_count"] == 1
        assert data["not_refreshed_count"] == 1
        assert data["failed_symbols"] == []


@pytest.mark.asyncio
class TestAPIAsync:
    """Test suite for async API functionality"""

    async def test_api_with_database_connection(self):
        """Test API behavior with actual database connections"""
        # This would require test database setup
        # For now, we'll just verify the test structure
        assert True  # Placeholder for actual database integration tests 