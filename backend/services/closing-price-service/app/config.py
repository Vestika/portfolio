from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Configuration
    app_name: str = "Closing Price Service"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # MongoDB Configuration
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "closing_price_service"
    
    # Redis Configuration
    redis_url: str = "redis://localhost:6379"
    redis_db: int = 0
    
    # Finnhub Configuration
    finnhub_api_key: str = ""
    finnhub_base_url: str = "https://finnhub.io/api/v1"
    
    # Cache Configuration
    cache_ttl_seconds: int = 86400  # 24 hours
    tracking_expiry_days: int = 7
    
    # Background job configuration
    refresh_job_hour: int = 9  # 9 AM
    refresh_job_minute: int = 0
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings() 