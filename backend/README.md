# Portfolio Playground

This directory contains the main application and utilities for the portfolio management system.

## Simplified Closing Price Service

The application uses a simplified closing price module that provides stock prices and currency exchange rates through direct imports. No HTTP services required!

### Quick Start

1. **Install dependencies** (from project root):
   ```bash
   pip install -r requirements.txt
   ```

2. **Set environment variables** (optional):
   ```bash
   # Database connections (will use defaults if not set)
   export MONGODB_URL=mongodb://localhost:27017
   export REDIS_URL=redis://localhost:6379
   
   # Finnhub API key for real-time US stock prices
   export FINNHUB_API_KEY=your_api_key_here
   ```

3. **Start required services**:
   ```bash
   # Start MongoDB and Redis (you can use the microservice's docker-compose)
   cd backend/services/closing-price-service
   docker-compose up mongodb redis
   ```

4. **Run the application**:
   ```bash
   cd playground
   PYTHONPATH=$(pwd)/.. uvicorn app.main:app --reload --port 8000
   ```

5. **Test the closing price service**:
   ```bash
   cd playground
   python closing_price_example.py
   ```

### How It Works

The closing price functionality has been converted from a microservice to a simple Python module located at `playground/services/closing_price/`. This provides:

- **Stock Prices**: US stocks via Finnhub API, TASE stocks via pymaya
- **Currency Exchange**: Real-time exchange rates between currencies
- **Caching**: Redis-based caching with MongoDB persistence
- **Tracking**: Symbol tracking and automatic cleanup

### Usage Examples

**Basic Usage:**
```python
from services.closing_price import ClosingPriceService

# Create service instance
price_service = ClosingPriceService()

# Get stock price (async)
price_data = await price_service.get_price("AAPL")
print(f"AAPL: ${price_data['price']:.2f}")

# Get exchange rate (async)
rate = await price_service.get_exchange_rate("USD", "ILS")
print(f"USD/ILS: {rate:.4f}")

# Synchronous methods also available
price_data_sync = price_service.get_price_sync("MSFT")
rate_sync = price_service.get_exchange_rate_sync("USD", "EUR")
```

**Portfolio Calculator Integration:**
```python
from portfolio_calculator import PortfolioCalculator
from services.closing_price import ClosingPriceService

# The portfolio calculator automatically uses the closing price service
calculator = PortfolioCalculator(
    base_currency=portfolio.base_currency,
    exchange_rates=portfolio.exchange_rates,
    unit_prices=portfolio.unit_prices,
    use_real_time_rates=True
)
```

### Configuration

Configure via environment variables:

```bash
# Database settings
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=closing_price_service
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# API settings
FINNHUB_API_KEY=your_api_key_here
FINNHUB_BASE_URL=https://finnhub.io/api/v1

# Cache settings
CACHE_TTL_SECONDS=86400
TRACKING_EXPIRY_DAYS=7

# Logging
LOG_LEVEL=INFO
```

### Files and Structure

```
playground/
├── services/
│   └── closing_price/
│       ├── __init__.py                 # Main exports
│       ├── service.py                  # Main service class
│       ├── price_manager.py            # Price fetching and caching
│       ├── currency_service.py         # Exchange rate service
│       ├── stock_fetcher.py            # Stock price fetchers
│       ├── database.py                 # Database connections
│       ├── models.py                   # Data models
│       └── config.py                   # Configuration
├── app/
│   └── main.py                         # FastAPI application
├── portfolio_calculator.py             # Portfolio calculations
├── closing_price_example.py            # Usage example
└── README.md                           # This file
```

### Benefits of the Simplified Approach

- **Single Process**: No need to run separate microservices
- **Direct Access**: Faster performance without HTTP overhead
- **Simplified Development**: Easier debugging and development
- **Same Functionality**: All features preserved from the microservice
- **Easy Migration**: Can easily be converted back to microservice if needed

### Dependencies

The closing price module requires:
- **MongoDB**: For persistent storage of prices and tracking
- **Redis**: For caching
- **Finnhub API Key**: For US stock prices (free tier available)
- **pymaya**: For TASE stock prices (Israeli market)

### Future Migration

If you later need to scale to a microservice architecture, the service can easily be extracted back to a separate HTTP service since the interface remains the same. 