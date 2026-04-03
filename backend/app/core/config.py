"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "Health Data Bank"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # Security
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_BACKEND: str = "memory"
    REDIS_URL: str = "redis://localhost:6379/0"
    RATE_LIMIT_ALERT_THRESHOLD: int = 5
    SCHEDULED_BACKUPS_ENABLED: bool = True
    SCHEDULED_BACKUP_HOUR_UTC: int = 2
    SCHEDULED_BACKUP_MINUTE_UTC: int = 0

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, bool):
            return value
        if value is None:
            return True
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
            return True
        if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
            return False
        return value

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",   
    )

settings = Settings()
