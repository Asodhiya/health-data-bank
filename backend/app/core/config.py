"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "Health Data Bank"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",   
    )

settings = Settings()