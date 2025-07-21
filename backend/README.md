# Portfolio Backend

A FastAPI-based backend for the portfolio management system with AI-powered analysis, real-time stock tracking, and comprehensive portfolio calculations.

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+** (recommended: 3.13.3)
- **Poetry** for dependency management
- **MongoDB** and **Redis** for data storage and caching
- **API Keys** for external services (Finnhub, Google AI, Firebase)

### Local Development Setup

#### 1. Python Environment Setup

**Option A: Using pyenv (Recommended)**
```bash
# Install pyenv and pyenv-virtualenv
brew install pyenv pyenv-virtualenv

# Install Python 3.13.3
pyenv install 3.13.3
pyenv local 3.13.3

# Create virtual environment
pyenv virtualenv 3.13.3 portfolio-backend
pyenv activate portfolio-backend
pyenv local portfolio-backend

# Add to ~/.zshrc:
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
```

**Option B: Using venv**
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### 2. Install Poetry and Dependencies

```bash
# Install Poetry (if not already installed)
curl -sSL https://install.python-poetry.org | python3 -

# Install project dependencies
poetry install

# Or install without dev dependencies for production
poetry install --no-dev
```

#### 3. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env with your configuration
# See Environment Variables section below
```

#### 4. Database Setup

**Using Docker (Recommended)**
```bash
# Start MongoDB and Redis
docker run -d --name mongodb -p 27017:27017 mongo:latest
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Using Local Installation**
- Install MongoDB: https://docs.mongodb.com/manual/installation/
- Install Redis: https://redis.io/download

#### 5. Start the Development Server

```bash
# Start with auto-reload
poetry run uvicorn app.main:app --reload --port 8080

# Or start without reload
poetry run uvicorn app.main:app --port 8080
```

The API will be available at `http://localhost:8080`

## 🔧 Environment Variables

Create a `.env` file in the backend directory:

```bash
# Database Configuration
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=closing_price_service

# Redis Configuration  
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# Finnhub API Configuration (required for US stocks)
# Get your free API key from https://finnhub.io/
FINNHUB_API_KEY=your_finnhub_api_key_here
FINNHUB_BASE_URL=https://finnhub.io/api/v1

# Cache Configuration
CACHE_TTL_SECONDS=86400
TRACKING_EXPIRY_DAYS=7

# Logging
LOG_LEVEL=INFO

# Firebase Configuration
FIREBASE_FILE_PATH=firebase_credentials.json
FIREBASE_CREDENTIALS={}

# Google AI Configuration
# Get your API key from https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
GOOGLE_AI_MODEL=gemini-2.5-flash-preview-04-17
```

### Required API Keys

1. **Finnhub API Key**: Required for US stock prices
   - Sign up at https://finnhub.io/
   - Free tier available with rate limits

2. **Google AI API Key**: Required for AI analysis features
   - Get from https://aistudio.google.com/apikey
   - Used for portfolio analysis and insights

3. **Firebase Credentials**: Required for authentication
   - Set up Firebase project
   - Download service account credentials
   - Place in `firebase_credentials.json` or set in `FIREBASE_CREDENTIALS`

## 🏗️ Project Structure

```
backend/
├── app/                    # FastAPI application
│   ├── __init__.py
│   └── main.py            # Main FastAPI app
├── core/                   # Core business logic
│   ├── ai_analyst.py      # AI analysis functionality
│   ├── auth.py            # Authentication logic
│   ├── chat_manager.py    # Chat management
│   ├── database.py        # Database connections
│   ├── portfolio_analyzer.py # Portfolio analysis
│   └── ...                # Other core modules
├── models/                 # Data models
│   ├── account.py         # Account models
│   ├── portfolio.py       # Portfolio models
│   ├── security.py        # Security models
│   └── ...                # Other models
├── services/              # External services
│   ├── closing_price/     # Stock price service
│   └── interactive_brokers/ # IB integration
├── data/                  # Data files
├── pyproject.toml         # Poetry configuration
├── poetry.lock           # Locked dependencies
└── env.example           # Environment template
```

## 📊 Features

### Simplified Closing Price Service

The application uses a simplified closing price module that provides stock prices and currency exchange rates through direct imports. No HTTP services required!

**Key Features:**
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

## 🧪 Testing

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=app

# Run specific test file
poetry run pytest tests/test_portfolio_analyzer.py
```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8080/docs
- **ReDoc**: http://localhost:8080/redoc

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# From project root
docker-compose up --build
```

### Manual Docker Build

```bash
# Build the image
docker build -t portfolio-backend .

# Run the container
docker run -p 8080:8080 --env-file .env portfolio-backend
```

## 🔍 Development Commands

```bash
# Format code
poetry run black .

# Lint code
poetry run flake8 .

# Type checking
poetry run mypy .

# Run development server
poetry run uvicorn app.main:app --reload --port 8080

# Run production server
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## 📦 Dependencies

Key dependencies managed by Poetry:

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **Pydantic**: Data validation
- **MongoDB**: Database driver
- **Redis**: Caching
- **Finnhub**: Stock data API
- **Google GenAI**: AI analysis
- **Firebase Admin**: Authentication

See `pyproject.toml` for complete dependency list.

## 🤝 Contributing

1. Set up the development environment
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 