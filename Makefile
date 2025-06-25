.PHONY: help run playground closing-price ui clean install

# Default target
help:
	@echo "Available commands:"
	@echo "  make run              - Run all services (playground API, closing-price service, and UI)"
	@echo "  make playground       - Run only the playground API service"
	@echo "  make closing-price    - Run only the closing-price service"
	@echo "  make ui               - Run only the UI development server"
	@echo "  make install          - Install dependencies for all services"
	@echo "  make clean            - Clean up temporary files and caches"

# Run all services
run:
	@echo "🚀 Starting all services..."
	@echo "📊 Starting Portfolio API (playground)..."
	@cd playground && PYTHONPATH=$(shell pwd) uvicorn app.main:app --reload --port 8000 &
	@echo "💰 Starting Closing Price Service..."
	@cd backend/services/closing-price-service && uvicorn app.main:app --reload --port 8001 &
	@echo "🎨 Starting UI Development Server..."
	@cd playground-dashboard && npm run dev &
	@echo ""
	@echo "✅ All services started!"
	@echo "📊 Portfolio API: http://localhost:8000"
	@echo "💰 Closing Price Service: http://localhost:8001"
	@echo "🎨 UI Dashboard: http://localhost:5173"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@wait

# Run only playground API
playground:
	@echo "📊 Starting Portfolio API (playground)..."
	@cd playground && PYTHONPATH=$(shell pwd) uvicorn app.main:app --reload --port 8000

# Run only closing-price service
closing-price:
	@echo "💰 Starting Closing Price Service..."
	@cd backend/services/closing-price-service && uvicorn app.main:app --reload --port 8001

# Run only UI
ui:
	@echo "🎨 Starting UI Development Server..."
	@cd playground-dashboard && npm run dev

# Install dependencies
install:
	@echo "📦 Installing Python dependencies..."
	@pip install -r requirements.txt
	@echo "📦 Installing closing-price service dependencies..."
	@cd backend/services/closing-price-service && pip install -r requirements.txt
	@echo "📦 Installing UI dependencies..."
	@cd playground-dashboard && npm install
	@echo "✅ All dependencies installed!"

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -delete 2>/dev/null || true
	@cd playground-dashboard && rm -rf node_modules/.vite 2>/dev/null || true
	@echo "✅ Cleanup complete!" 