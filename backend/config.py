from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings for the closing price module"""
    
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # MongoDB Configuration
    mongodb_url: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URL"
    )
    mongodb_database: str = Field(
        default="vestika",
        description="MongoDB database name"
    )
    
    # Redis Configuration
    use_fake_redis: bool = Field(
        default=True,
        description="Whether to use fake Redis for testing"
    )
    redis_url: str = Field(
        default="redis://localhost:6379",
        description="Redis connection URL"
    )
    redis_db: int = Field(
        default=0,
        description="Redis database number"
    )
    
    # Finnhub Configuration
    finnhub_api_key: str = Field(
        default="",
        description="Finnhub API key for stock data"
    )
    finnhub_base_url: str = Field(
        default="https://finnhub.io/api/v1",
        description="Finnhub API base URL"
    )
    
    # Cache Configuration
    cache_ttl_seconds: int = Field(
        default=86400,
        description="Cache TTL in seconds (24 hours)"
    )
    tracking_expiry_days: int = Field(
        default=7,
        description="Number of days to track expiry"
    )
    
    # Logging
    log_level: str = Field(
        default="INFO",
        description="Logging level"
    )



    firebase_file_path: Optional[str] = Field(
        default="firebase_credentials.json",
        description="Path to Firebase credentials JSON file"
    )
    
    firebase_credentials: Optional[str] = Field(
        default=None,
        description="Firebase credentials JSON string from environment variable"
    )
    
    # Google AI Configuration
    google_ai_api_key: str = Field(
        default="",
        description="Google AI API key for Gemini integration"
    )
    google_ai_model: str = Field(
        default="gemini-2.5-flash",
        description="Google AI model to use for analysis"
    )

    # Telegram Bot Configuration
    telegram_bot_token: Optional[str] = Field(
        default=None,
        description="Telegram bot token for sending feedback notifications"
    )
    telegram_chat_id: Optional[str] = Field(
        default=None,
        description="Telegram chat ID (user/group/channel) to receive feedback notifications"
    )

    # Mixpanel Analytics Configuration
    mixpanel_api_key: Optional[str] = Field(
        default=None,
        description="Mixpanel API key for analytics tracking"
    )
    mixpanel_enabled: bool = Field(
        default=False,
        description="Enable/disable Mixpanel analytics"
    )
    mixpanel_mock_mode: bool = Field(
        default=False,
        description="Run Mixpanel in mock mode (for testing)"
    )

    # Userjam Analytics Configuration
    userjam_api_key: Optional[str] = Field(
        default=None,
        description="Userjam API key for analytics tracking"
    )


# Global settings instance
settings = Settings() 