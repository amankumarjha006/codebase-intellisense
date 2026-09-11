from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Codebase Intelligence"
    API_V1_STR: str = "/api/v1"
    
    # Infrastructure
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5433/codebase_intellisense"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Placeholders for future integrations
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    EMBEDDING_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
