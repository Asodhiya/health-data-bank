"""
Application Configuration
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional
from pydantic import Field

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# This points to 'backend' folder
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "Health Data Bank"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Supabase
    SUPABASE_URL: str = Field(..., description="Supabase Project URL")
    SUPABASE_ANON_KEY: str = Field(..., description="Supabase Anon/Public Key")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    # Database
    DATABASE_URL: str
    
    # Authentication
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    
    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = 'utf-8'
        case_sensitive = True


# Global settings instance
settings = Settings()
