# Closing Price Service Makefile

.PHONY: help install test lint format type-check run docker-build docker-up docker-down clean

# Default target
help:
	@echo "Available commands:"
	@echo "  install      - Install Python dependencies"
	@echo "  test         - Run all tests"
	@echo "  lint         - Run linting (black + mypy)"
	@echo "  format       - Format code with black"
	@echo "  type-check   - Run mypy type checking"
	@echo "  run          - Run the service locally"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-up    - Start services with docker-compose"
	@echo "  docker-down  - Stop services with docker-compose"
	@echo "  clean        - Clean up cache files"

# Install dependencies
install:
	pip install --upgrade pip
	pip install -r requirements.txt

# Run tests
test:
	pytest -v --cov=app --cov-report=term-missing

# Run linting (format + type check)
lint: format type-check

# Format code
format:
	black app/ tests/ scripts/

# Type checking
type-check:
	mypy app/

# Run the service locally
run:
	python scripts/run_local.py

# Docker commands
docker-build:
	docker build -t closing-price-service .

docker-up:
	docker-compose up --build

docker-up-admin:
	docker-compose --profile admin up --build

docker-down:
	docker-compose down

# Clean up
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +

# Development setup
setup: install
	@echo "Setting up development environment..."
	@if [ ! -f .env ]; then \
		cp env.example .env; \
		echo "Created .env file from example"; \
		echo "Please edit .env with your Finnhub API key"; \
	fi
	@echo "Setup complete!"

# Run tests with coverage report
test-coverage:
	pytest --cov=app --cov-report=html --cov-report=term

# Quick development cycle
dev: format type-check test
	@echo "Development checks passed ✅" 