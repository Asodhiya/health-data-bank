"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "Health Data Bank"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Database
    #DATABASE_URL: Optional[str] = None

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
