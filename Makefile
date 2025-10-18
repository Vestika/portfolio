.PHONY: help run clean install stop setup backend frontend build

# Default target
help:
	@echo "Available commands:"
	@echo "  make setup            - Set up pyenv environment (first time setup)"
	@echo "  make run              - Run all services in the background"
	@echo "  make stop             - Stop all running services"
	@echo "  make backend          - Run only the backend API service"
	@echo "  make frontend         - Run only the UI development server"
	@echo "  make install          - Install dependencies for all services"
	@echo "  make build            - Build the frontend for production"
	@echo "  make clean            - Clean up temporary files and caches"

# Run all services
run:
	@echo "🚀 Starting all services..."
	@echo "📊 Starting Portfolio backend & API..."
	@cd backend && PYTHONPATH=. uvicorn app.main:app --reload --port 8000 &
	@echo "🎨 Starting UI Development Server..."
	@cd frontend && npm run dev &
	@echo ""
	@echo "✅ All services started!"
	@echo "📊 Portfolio API: http://localhost:8000"
	@echo "🎨 UI Dashboard: http://localhost:5173"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@wait

# Run only backend
backend:
	@echo "📊 Starting Portfolio backend & API..."
	@cd backend && PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Run only frontend
frontend:
	@echo "🎨 Starting UI Development Server..."
	@cd frontend && npm run dev

# Install dependencies
install:
	@echo "📦 Installing Python dependencies..."
	@echo "🔍 Checking Python environment..."
	@python --version || (echo "❌ Python not found. Please activate a pyenv environment (e.g., 'pyenv shell portfolio')" && exit 1)
	@poetry --version || (echo "❌ Poetry not available. Please install Poetry first: curl -sSL https://install.python-poetry.org | python3 -" && exit 1)
	@echo "📦 Installing backend dependencies with Poetry..."
	@cd backend && poetry lock && poetry install
	@echo "📦 Installing UI dependencies..."
	@cd frontend && npm install
	@echo "✅ All dependencies installed!"

# Build frontend for production
build:
	@echo "🏗️  Building frontend for production..."
	@cd frontend && pnpm build
	@echo "✅ Frontend build complete!"

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -delete 2>/dev/null || true
	@cd frontend && rm -rf node_modules/.vite 2>/dev/null || true
	@echo "✅ Cleanup complete!"

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	@echo "📊 Stopping Portfolio API (port 8000)..."
	@-lsof -ti:8000 | xargs -r kill -TERM 2>/dev/null || true
	@echo "🎨 Stopping UI Development Server (port 5173)..."
	@-lsof -ti:5173 | xargs -r kill -TERM 2>/dev/null || true
	@sleep 2
	@echo "🔄 Force killing any remaining processes..."
	@-lsof -ti:8000 | xargs -r kill -KILL 2>/dev/null || true
	@-lsof -ti:5173 | xargs -r kill -KILL 2>/dev/null || true
	@echo "✅ All services stopped!"

# Setup pyenv environment
setup:
	@echo "🔧 Setting up development environment..."
	@if command -v pyenv >/dev/null 2>&1; then \
		echo "✅ pyenv found"; \
		if pyenv versions | grep -q portfolio; then \
			echo "✅ portfolio environment exists"; \
			echo "portfolio" > .python-version; \
			echo "📝 Created .python-version file"; \
			echo "🔄 Environment will auto-activate when you cd into this directory"; \
			echo "💡 You may need to cd out and back in for it to take effect"; \
		else \
			echo "❌ portfolio environment not found"; \
			echo "📝 Available environments:"; \
			pyenv versions; \
			echo "💡 To create: pyenv virtualenv 3.13.3 portfolio"; \
		fi; \
	else \
		echo "❌ pyenv not found. Please install pyenv first."; \
	fi 