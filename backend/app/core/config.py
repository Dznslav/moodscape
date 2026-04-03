import secrets

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
                  
    PROJECT_NAME: str = "Moodscape API"
    VERSION: str = "1.0.0"

    DATABASE_URL: str = "postgresql://postgres:admin@localhost:5432/moodscape"
    REDIS_URL: str = "redis://localhost:6379/0"
    OPENWEATHER_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    SECRET_KEY: str = Field(
        default_factory=lambda: secrets.token_urlsafe(64),
        validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET_KEY"),
    )
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
