from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Codebase Intelligence"
    API_V1_STR: str = "/api/v1"
    
    # Application Environment
    ENVIRONMENT: str = "development"

    # Infrastructure
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5433/codebase_intellisense"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Application URLs
    FRONTEND_URL: str = "http://localhost:3000/dashboard"

    # GitHub App Configuration (Authentication Phase)
    # Note: GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY will be required in a future phase 
    # for server-to-server operations, but are not used for user authentication.
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_CALLBACK_URL: str = "http://localhost:8000/api/v1/auth/github/callback"
    GITHUB_TOKEN_ENCRYPTION_KEY: Optional[str] = None
    
    # Session Configuration
    SESSION_COOKIE_NAME: str = "session_id"
    SESSION_EXPIRE_SECONDS: int = 86400  # 24 hours
    
    # AI & Embedding Credentials (Future integration)
    GEMINI_API_KEY: Optional[str] = None
    EMBEDDING_API_KEY: Optional[str] = None

    # Indexing Configuration
    MAX_INDEXABLE_FILE_SIZE_BYTES: int = 5242880  # 5 MB

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
