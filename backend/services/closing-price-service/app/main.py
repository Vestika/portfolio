import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .api.routes import router
from .config import settings
from .database import connect_to_mongo, close_mongo_connection, connect_to_redis, close_redis_connection
from .scheduler import scheduler

# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    level=settings.log_level,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    try:
        logger.info("Starting Closing Price Service...")
        
        # Connect to databases
        await connect_to_mongo()
        await connect_to_redis()
        
        # Start background scheduler
        await scheduler.start()
        
        logger.info("Closing Price Service started successfully")
        yield
        
    except Exception as e:
        logger.error(f"Failed to start service: {e}")
        raise
    
    # Shutdown
    try:
        logger.info("Shutting down Closing Price Service...")
        
        # Stop background scheduler
        await scheduler.stop()
        
        # Close database connections
        await close_redis_connection()
        await close_mongo_connection()
        
        logger.info("Closing Price Service shut down successfully")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    A microservice for fetching and caching daily closing prices for stocks.
    
    ## Features
    
    * **US Stocks**: Fetch prices via Finnhub.io API
    * **TASE Stocks**: Fetch prices via pymaya library
    * **Caching**: Redis-based caching with MongoDB persistence
    * **Tracking**: Automatic tracking and cleanup of queried symbols
    * **Background Jobs**: Daily price refresh for tracked symbols
    
    ## Usage
    
    * Use alphabetic symbols for US stocks (e.g., "AAPL")
    * Use numeric symbols for TASE stocks (e.g., "1101534")
    """,
    lifespan=lifespan,
    debug=settings.debug
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs_url": "/docs"
    } 