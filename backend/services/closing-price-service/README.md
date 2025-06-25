# Closing Price Service

A Python microservice designed to serve daily closing prices for a dynamic set of stocks, supporting both US stock symbols via Finnhub.io and Tel-Aviv Stock Exchange (TASE) numeric symbols via pymaya.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation & Setup](#installation--setup)
- [Running the Service](#running-the-service)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Original Requirements](#original-requirements)

## Overview

This service is part of a mono-repo project and provides a RESTful API for fetching, caching, and tracking stock prices. It automatically handles different market types based on symbol format and provides intelligent caching with background refresh capabilities.

## Features

### Core Functionality
- **Multi-Market Support**: US stocks (Finnhub.io) and TASE stocks (pymaya)
- **Intelligent Caching**: Redis-based caching with MongoDB persistence
- **Smart Tracking**: Automatic symbol tracking with 7-day cleanup
- **Background Jobs**: Daily price refresh for tracked symbols
- **Lazy Loading**: Fetch prices on-demand without pre-tracking requirement

### Technical Features
- **FastAPI**: Modern, high-performance web framework
- **Type Safety**: Full type annotations with mypy enforcement
- **Code Quality**: Black formatting and comprehensive testing
- **Containerization**: Docker support with docker-compose
- **Monitoring**: Health checks and structured logging
- **Cloud Ready**: Environment-based configuration

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│   FastAPI App   │    │   MongoDB    │    │    Redis    │
│                 │    │              │    │             │
│  ┌───────────┐  │    │ ┌──────────┐ │    │ ┌─────────┐ │
│  │ API Routes│  │◄──►│ │ Stock    │ │    │ │ Price   │ │
│  └───────────┘  │    │ │ Prices   │ │    │ │ Cache   │ │
│                 │    │ └──────────┘ │    │ └─────────┘ │
│  ┌───────────┐  │    │              │    │             │
│  │Price Mgr. │  │    │ ┌──────────┐ │    └─────────────┘
│  └───────────┘  │    │ │ Tracked  │ │              
│                 │    │ │ Symbols  │ │    ┌─────────────┐
│  ┌───────────┐  │    │ └──────────┘ │    │ External    │
│  │Stock      │  │    └──────────────┘    │ APIs        │
│  │Fetchers   │  │                        │             │
│  └───────────┘  │                        │ ┌─────────┐ │
│                 │◄──────────────────────►│ │Finnhub  │ │
│  ┌───────────┐  │                        │ └─────────┘ │
│  │Scheduler  │  │                        │             │
│  └───────────┘  │                        │ ┌─────────┐ │
└─────────────────┘                        │ │pymaya   │ │
                                           │ └─────────┘ │
                                           └─────────────┘
```

## Installation & Setup

### Prerequisites

- Python 3.13.3+
- Docker and Docker Compose (for containerized setup)
- MongoDB (local or containerized)
- Redis (local or containerized)
- Finnhub.io API key (free tier available)

### Local Development Setup

1. **Clone and navigate to the service**:
   ```bash
   cd backend/services/closing-price-service
   ```

2. **Create and activate virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On macOS/Linux
   # or
   venv\Scripts\activate     # On Windows
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

5. **Get Finnhub API key**:
   - Visit [Finnhub.io](https://finnhub.io/)
   - Sign up for a free account
   - Get your API key and add it to `.env`

### Docker Setup

1. **Build and run with Docker Compose**:
   ```bash
   # Basic setup
   docker-compose up --build
   
   # With admin interfaces
   docker-compose --profile admin up --build
   ```

2. **Set environment variables**:
   ```bash
   export FINNHUB_API_KEY=your_api_key_here
   docker-compose up --build
   ```

## Running the Service

### Local Development

```bash
# Ensure MongoDB and Redis are running locally
uvicorn app.main:app --reload --port 8000
```

### Docker

```bash
# Run all services
docker-compose up

# Run with admin interfaces
docker-compose --profile admin up

# View logs
docker-compose logs -f closing-price-service
```

### Verification

1. Check service health: `http://localhost:8000/api/v1/health`
2. View API documentation: `http://localhost:8000/docs`
3. Access admin interfaces (if enabled):
   - MongoDB: `http://localhost:8081` (admin/admin123)
   - Redis: `http://localhost:8082`

## API Documentation

### Base URL
- Local: `http://localhost:8000/api/v1`
- Interactive docs: `http://localhost:8000/docs`

### Endpoints

#### GET /prices/{symbol}
Fetch the latest closing price for a specific symbol.

**Parameters:**
- `symbol` (path): Stock symbol (e.g., "AAPL" for US, "1101534" for TASE)

**Response:**
```json
{
  "symbol": "AAPL",
  "price": 150.25,
  "currency": "USD",
  "market": "US",
  "date": "2024-01-15",
  "fetched_at": "2024-01-15T10:30:00Z"
}
```

#### GET /prices
Fetch latest prices for all tracked symbols.

**Response:**
```json
[
  {
    "symbol": "AAPL",
    "price": 150.25,
    "currency": "USD",
    "market": "US",
    "date": "2024-01-15",
    "fetched_at": "2024-01-15T10:30:00Z"
  }
]
```

#### POST /prices
Add symbols to the tracking list.

**Request Body:**
```json
{
  "symbols": ["AAPL", "MSFT", "1101534"]
}
```

**Response:**
```json
{
  "AAPL": "added",
  "MSFT": "already_tracked",
  "1101534": "added"
}
```

#### POST /prices/refresh
Manually refresh all tracked symbols.

**Response:**
```json
{
  "message": "Refreshed 3 symbols",
  "refreshed_count": 3,
  "failed_symbols": []
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "closing-price-service"
}
```

### Examples

```bash
# Get price for Apple stock
curl http://localhost:8000/api/v1/prices/AAPL

# Get price for TASE stock
curl http://localhost:8000/api/v1/prices/1101534

# Track multiple symbols
curl -X POST http://localhost:8000/api/v1/prices \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL", "MSFT", "GOOGL"]}'

# Get all tracked prices
curl http://localhost:8000/api/v1/prices

# Manually refresh prices
curl -X POST http://localhost:8000/api/v1/prices/refresh
```

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_api.py

# Run with verbose output
pytest -v

# Run async tests only
pytest -k "async"
```

### Test Structure

- `tests/test_api.py`: API endpoint tests
- `tests/test_services.py`: Service layer tests
- Tests include mocking for external APIs
- Comprehensive coverage of success and failure scenarios

### Manual Testing

1. **Start the service**:
   ```bash
   docker-compose up
   ```

2. **Test US stock**:
   ```bash
   curl http://localhost:8000/api/v1/prices/AAPL
   ```

3. **Test TASE stock** (requires pymaya to work):
   ```bash
   curl http://localhost:8000/api/v1/prices/1101534
   ```

4. **Test tracking**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/prices \
     -H "Content-Type: application/json" \
     -d '{"symbols": ["AAPL", "MSFT"]}'
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FINNHUB_API_KEY` | Finnhub.io API key | Required |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `CACHE_TTL_SECONDS` | Cache expiration time | `86400` (24 hours) |
| `TRACKING_EXPIRY_DAYS` | Days before removing unused symbols | `7` |
| `REFRESH_JOB_HOUR` | Daily refresh hour (24h format) | `9` |
| `REFRESH_JOB_MINUTE` | Daily refresh minute | `0` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `DEBUG` | Enable debug mode | `false` |

### Code Quality

```bash
# Format code
black app/ tests/

# Type checking
mypy app/

# Run both
black app/ tests/ && mypy app/
```

## Deployment

### Production Considerations

1. **Environment Configuration**:
   - Set `DEBUG=false`
   - Use strong database credentials
   - Configure CORS properly
   - Set appropriate log levels

2. **Scaling**:
   - Use Redis Cluster for high availability
   - MongoDB replica sets for production
   - Multiple service instances behind load balancer

3. **Monitoring**:
   - Health check endpoints
   - Structured logging with loguru
   - Consider adding metrics collection

### Cloud Deployment

The service is designed to be cloud-ready:

- **Container Registry**: Push Docker image to your registry
- **Kubernetes**: Use provided Docker image
- **Cloud Databases**: Compatible with managed MongoDB and Redis
- **Environment Variables**: All configuration via environment

### Example Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: closing-price-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: closing-price-service
  template:
    metadata:
      labels:
        app: closing-price-service
    spec:
      containers:
      - name: closing-price-service
        image: your-registry/closing-price-service:latest
        ports:
        - containerPort: 8000
        env:
        - name: FINNHUB_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: finnhub-api-key
        - name: MONGODB_URL
          value: "mongodb://mongo-service:27017"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
```

## Original Requirements

This service was built to fulfill the following requirements:

---

**Design a Python microservice named closing-price-service to serve daily closing prices for a dynamic set of stocks, including both:**
* US stock symbols (e.g., AAPL) via finnhub.io
* Tel-Aviv Stock Exchange numeric symbols (e.g., 1101534) via pymaya==0.2.1

This service is part of a mono-repo project, designed as a standalone service directory.

**Core Features:**

1. **Price Fetching & Storage**
   - a. Retrieve latest daily closing prices for a symbol.
   - b. US stocks via finnhub.io (free tier).
   - c. TASE stocks via pymaya.
   - d. Store prices and metadata in MongoDB
   - e. Cached prices must persist across service restarts.
   - f. Every day, previously fetched prices may be outdated, so they must be refreshed daily via a background job.

2. **Tracking Logic**
   - a. Maintain a list of explicitly tracked symbols to optimize background refresh.
   - b. If a symbol is queried but not tracked, lazy-fetch and cache it (don't require pre-tracking).
   - c. Drop any tracked symbol not queried for more than 7 consecutive days.

3. **REST API (FastAPI)**
   - a. Follow RESTful conventions (plural nouns, clear resource semantics).
   - b. Endpoints:
     - i. GET /prices/{symbol} – Fetch the latest closing price (triggers lazy-fetch if untracked).
     - ii. GET /prices – Fetch the latest closing price of all tracked symbols
     - iii. POST /prices – Add symbols to the tracked list.
     - iv. POST /prices/refresh – Manually refresh all tracked symbols.

4. **Development & Runtime**
   - a. Written in Python 3.13.3.
   - b. Follow strong conventions:
     - i. Use type annotations
     - ii. Enforce mypy for static typing
     - iii. Use black for formatting
   - c. Fully runnable on macOS for local development.
   - d. Includes Docker and docker-compose.yml for MongoDB/Redis setup.
   - e. Cloud-deployable when needed.
   - f. Write a README file that specifies what this is, how to run it, how to test it, and include this entire prompt in there as well

---

## Contributing

1. Follow the existing code style (Black formatting)
2. Add type annotations for all functions
3. Write tests for new functionality
4. Update documentation as needed
5. Ensure mypy passes without errors

## License

This project is part of a mono-repo and follows the repository's licensing terms. 