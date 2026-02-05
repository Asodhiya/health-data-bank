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

    # Supabase (kept for future use)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:54322/postgres"

    # Authentication
    JWT_SECRET: str = "change-me-in-production-at-least-32-characters"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Cookie
    COOKIE_NAME: str = "access_token"
    COOKIE_HTTPONLY: bool = True
    COOKIE_SECURE: bool = False        # True in production (requires HTTPS)
    COOKIE_SAMESITE: str = "lax"
    COOKIE_PATH: str = "/"
    COOKIE_DOMAIN: Optional[str] = None  # Set in production

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
