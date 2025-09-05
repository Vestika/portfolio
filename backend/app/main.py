"""
Main FastAPI application with endpoints organized in separate modules
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import feature_generator
from core.database import db_manager
from core.firebase import FirebaseAuthMiddleware
from models import User, Product, UserPreferences, Symbol
from services.closing_price.service import get_global_service

# Import endpoint routers
from .endpoints.portfolio import router as portfolio_router
from .endpoints.tags import router as tags_router
from .endpoints.ai_chat import router as ai_chat_router
from .endpoints.user import router as user_router
from .endpoints.market import router as market_router
from .endpoints.news import router as news_router
from .endpoints.ibkr import router as ibkr_router
from .endpoints.files import router as files_router

logger = logging.Logger(__name__)

# Get the global closing price service
closing_price_service = get_global_service()

# Create FastAPI app
app = FastAPI(
    title="Portfolio API",
    description="API for managing investment portfolios",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://app.vestika.io"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Firebase authentication middleware
app.add_middleware(
    FirebaseAuthMiddleware,
    exclude_paths=["/docs", "/openapi.json", "/redoc"]
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    try:
        logger.info("Starting up Portfolio API...")

        # Try to initialize the closing price service (optional)
        try:
            await closing_price_service.initialize()
            logger.info("Closing price service initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize closing price service: {e}")

        # Try to connect to database (optional)
        try:
            await db_manager.connect("vestika")
            logger.info("Database connected successfully")

            # Register feature models only if database is available
            models_to_register = [User, Product, UserPreferences, Symbol]
            for model_class in models_to_register:
                router = feature_generator.register_feature(model_class)
                app.include_router(router, prefix="/api/v1")
        except Exception as e:
            logger.warning(f"Failed to connect to database: {e}")

        logger.info("Portfolio API startup completed successfully")

    except Exception as e:
        logger.error(f"Failed to start Portfolio API: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on application shutdown"""
    try:
        logger.info("Shutting down Portfolio API...")
        # Clean up the closing price service
        await closing_price_service.cleanup()
        logger.info("Portfolio API shutdown completed successfully")
    except Exception as e:
        logger.warning(f"Error during shutdown: {e}")

# Include all endpoint routers
app.include_router(portfolio_router)
app.include_router(tags_router)
app.include_router(ai_chat_router)
app.include_router(user_router)
app.include_router(market_router)
app.include_router(news_router)
app.include_router(ibkr_router)
app.include_router(files_router)

# Predefined charts with their aggregation keys - keep this here as it's used by portfolio endpoints
from utils import filter_security
from typing import Any

CHARTS: list[dict[str, Any]] = [
    {
        "title": "Account Size Overview",
        "aggregation_key": None,
        "account_filter": None,
        "security_filter": None,
        "ignore_missing_key": False,
    },
    {
        "title": "Holdings Aggregation By Symbol",
        "aggregation_key": filter_security.by_symbol,
        "account_filter": None,
        "security_filter": None,
        "ignore_missing_key": False,
    },
]
