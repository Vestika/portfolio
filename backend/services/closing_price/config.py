import os
from pathlib import Path

# Try to load .env file if available
try:
    from dotenv import load_dotenv
    
    # Look for .env file in playground directory
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        print(f"Loaded environment from: {env_file}")
except ImportError:
    # python-dotenv not installed, skip
    pass


class Settings:
    """Configuration settings for the closing price module"""
    
    def __init__(self):
        # MongoDB Configuration
        self.mongodb_url: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.mongodb_database: str = os.getenv("MONGODB_DATABASE", "closing_price_service")
        
        # Redis Configuration
        self.redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_db: int = int(os.getenv("REDIS_DB", "0"))
        
        # Finnhub Configuration
        self.finnhub_api_key: str = os.getenv("FINNHUB_API_KEY", "")
        self.finnhub_base_url: str = os.getenv("FINNHUB_BASE_URL", "https://finnhub.io/api/v1")
        
        # Cache Configuration
        self.cache_ttl_seconds: int = int(os.getenv("CACHE_TTL_SECONDS", "86400"))  # 24 hours
        self.tracking_expiry_days: int = int(os.getenv("TRACKING_EXPIRY_DAYS", "7"))
        
        # Logging
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")


# Global settings instance
settings = Settings() 