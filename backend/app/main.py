"""
Main FastAPI application with endpoints organized in separate modules
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.database import db_manager
from core.firebase import FirebaseAuthMiddleware
from services.closing_price.service import get_global_service

# Import endpoint routers
from .endpoints.portfolio import router as portfolio_router
from .endpoints.tags import router as tags_router
from .endpoints.ai_chat import router as ai_chat_router
from .endpoints.user import router as user_router
from .endpoints.profile import router as profile_router
from .endpoints.settings import router as settings_router
from .endpoints.market import router as market_router
from .endpoints.news import router as news_router
from .endpoints.ibkr import router as ibkr_router
from .endpoints.files import router as files_router
from .endpoints.notifications import router as notifications_router
from .endpoints.custom_charts import router as custom_charts_router
from .endpoints.real_estate import router as real_estate_router
from .endpoints.feedback import router as feedback_router
from .endpoints.extension import router as extension_router
from .endpoints.tax_planner import router as tax_planner_router

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
    exclude_paths=[
        "/docs", 
        "/openapi.json", 
        "/redoc",
        "/cache/status",
        "/cache/historical",
        "/cache/scheduler/status"
    ]
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
            
            # Create database indexes for closing price service
            from services.closing_price.database import create_database_indexes
            await create_database_indexes()

            # Create TTL index for extraction_sessions (auto-expire after 1 hour)
            try:
                db = await db_manager.get_database("vestika")
                await db.extraction_sessions.create_index(
                    "created_at",
                    expireAfterSeconds=3600  # 1 hour
                )
                logger.info("Created TTL index for extraction_sessions")
            except Exception as index_err:
                logger.warning(f"Failed to create extraction_sessions index: {index_err}")
            
            # Start the background scheduler for historical price caching
            # Scheduler now runs initial sync at T+0 automatically!
            try:
                from services.closing_price.scheduler import start_scheduler
                start_scheduler()
                logger.info("Historical price caching scheduler started successfully")
                logger.info("Initial sync will run immediately (T+0), then every 3 hours")
            except Exception as scheduler_err:
                logger.warning(f"Failed to start scheduler: {scheduler_err}")
            
        except Exception as e:
            logger.warning(f"Failed to initialize closing price service: {e}")

        # Try to test database connection (optional)
        try:
            test_db = await db_manager.get_database("vestika")
            # Test the connection by attempting to list collections
            await test_db.list_collection_names()
            logger.info("Database connection tested successfully")

            # Seed default notification templates
            try:
                from core.notification_service import get_notification_service
                notification_service = get_notification_service()
                seeded_count = await notification_service.seed_default_templates()
                if seeded_count > 0:
                    logger.info(f"Seeded {seeded_count} default notification templates")
                else:
                    logger.info("Default notification templates already exist")
            except Exception as e:
                logger.warning(f"Failed to seed default notification templates: {e}")

            # Auto-populate symbols if data is older than 1 month OR collection is empty
            try:
                logger.info("Checking symbols data age...")
                from populate_symbols import is_symbols_data_stale, populate_symbols, symbols_collection_exists
                
                # Check if symbols collection exists at all
                collection_exists = await symbols_collection_exists()
                is_stale = await is_symbols_data_stale(max_age_days=30)
                
                if not collection_exists or is_stale:
                    if not collection_exists:
                        logger.info("Symbols collection is empty, forcing full population...")
                        force_populate = True  # Force when collection is empty
                    else:
                        logger.info("Symbols data is stale, starting population...")
                        force_populate = False  # Use checksum logic when data exists
                    
                    # First run cleanup to remove any existing duplicates
                    if collection_exists:  # Only cleanup if collection exists
                        try:
                            from populate_symbols import cleanup_duplicate_symbols
                            cleanup_result = await cleanup_duplicate_symbols()
                            logger.info(f"Pre-population cleanup: removed {cleanup_result['duplicates_removed']} duplicates")
                        except Exception as cleanup_err:
                            logger.warning(f"Pre-population cleanup failed: {cleanup_err}")
                    
                    result = await populate_symbols(force=force_populate)
                    logger.info(f"Symbol population completed: {result['total_symbols']} total symbols")
                    if result['updated_types']:
                        logger.info(f"Updated symbol types: {result['updated_types']}")
                    if result['skipped_types']:
                        logger.info(f"Skipped symbol types (already up to date): {result['skipped_types']}")
                else:
                    logger.info("Symbols data is fresh, skipping population")
                    
            except Exception as e:
                logger.warning(f"Failed to check/populate symbols on startup: {e}")

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
        
        # Stop the scheduler
        try:
            from services.closing_price.scheduler import stop_scheduler
            stop_scheduler()
            logger.info("Scheduler stopped successfully")
        except Exception as scheduler_err:
            logger.warning(f"Error stopping scheduler: {scheduler_err}")
        
        # Clean up the closing price service
        await closing_price_service.cleanup()
        
        # Clean up database connections
        await db_manager.disconnect()
        logger.info("Database connections closed")
        
        logger.info("Portfolio API shutdown completed successfully")
    except Exception as e:
        logger.warning(f"Error during shutdown: {e}")

# Include all endpoint routers
app.include_router(portfolio_router)
app.include_router(tags_router)
app.include_router(ai_chat_router)
app.include_router(user_router)
app.include_router(profile_router)
app.include_router(settings_router)
app.include_router(market_router)
app.include_router(news_router)
app.include_router(ibkr_router)
app.include_router(files_router)
app.include_router(notifications_router)
app.include_router(custom_charts_router)
app.include_router(real_estate_router)
app.include_router(feedback_router)
app.include_router(extension_router)
app.include_router(tax_planner_router)

# Mount static files for uploaded profile images
import os
if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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
