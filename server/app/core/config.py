from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, model_validator
from typing import Optional, Any, Union
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
    
    # Application URLs & CORS
    FRONTEND_URL: str = "http://localhost:3000/dashboard"
    CORS_ORIGINS: Union[list[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

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
    SESSION_COOKIE_SAMESITE: str = "lax"  # "lax", "none", or "strict"
    SESSION_COOKIE_SECURE: Optional[bool] = None  # Auto-inferred from ENVIRONMENT == "production" if None

    # Dev Authentication Backdoor Guard
    ENABLE_DEV_LOGIN: bool = False

    # API Documentation in Production
    ENABLE_API_DOCS: bool = False
    
    # AI & Embedding Credentials (Future integration)
    GEMINI_API_KEY: Optional[str] = None

    # Indexing Configuration
    MAX_INDEXABLE_FILE_SIZE_BYTES: int = 200000  # 200 KB per-file limit
    INDEXING_MAX_ESTIMATED_TOKENS: int = 3000000  # 3M token cap per repository
    INDEXING_DATA_FILE_MAX_BYTES: int = 50000     # 50 KB limit for data files (csv, json, etc)
    CHUNK_MAX_CHARS: int = 4096
    
    # Retrieval Configuration
    CONTEXT_MAX_CHARS: int = 32000

    # Embedding Configuration
    EMBEDDING_PROVIDER: str = "google"
    EMBEDDING_MODEL: str = "gemini-embedding-2"
    EMBEDDING_FALLBACK_MODEL: Optional[str] = "gemini-embedding-001"
    EMBEDDING_DIMENSION: int = 768
    EMBEDDING_MAX_RETRIES: int = 5
    EMBEDDING_CHARS_PER_TOKEN: int = 3

    # Batch limits calibrated for Google AI Studio Free Tier (100 RPM, 30k TPM, 1k RPD)
    EMBEDDING_MAX_BATCH_ITEMS: int = 32
    EMBEDDING_MAX_BATCH_TOKENS: int = 8500
    EMBEDDING_MIN_INTERVAL_SECONDS: float = 2.0
    EMBEDDING_TARGET_TPM: int = 24000

    # LLM Configuration
    LLM_PRIMARY_PROVIDER: str = "gemini"
    LLM_FALLBACK_ENABLED: bool = True
    LLM_FALLBACK_PROVIDER: str = "openrouter"
    GEMINI_LLM_MODEL_PRIMARY: str = "gemini-2.5-flash"
    GEMINI_LLM_MODEL_FALLBACK_1: Optional[str] = "gemini-3.8-flash"
    GEMINI_LLM_MODEL_FALLBACK_2: Optional[str] = "gemini-3.7-flash"
    ARCHITECTURE_LLM_ENRICHMENT_ENABLED: bool = True
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_FALLBACK_MODEL: str = "openrouter/free"
    
    # Observability Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    REQUEST_ID_HEADER: str = "X-Request-ID"
    
    # Rate Limiting Configuration
    RATE_LIMIT_ENABLED: bool = True
    
    RATE_LIMIT_GENERAL_REQUESTS: int = 120
    RATE_LIMIT_GENERAL_WINDOW_SECONDS: int = 60
    
    RATE_LIMIT_RAG_REQUESTS: int = 20
    RATE_LIMIT_RAG_WINDOW_SECONDS: int = 60
    
    RATE_LIMIT_STREAM_REQUESTS: int = 10
    RATE_LIMIT_STREAM_WINDOW_SECONDS: int = 60

    # Worker Configuration
    WORKER_BLOCKING_TIMEOUT_SECONDS: int = 20

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: Any) -> str:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("postgres://"):
                return "postgresql+psycopg://" + v[len("postgres://"):]
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            if not v.strip():
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i).strip() for i in v if str(i).strip()]
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    @model_validator(mode="after")
    def validate_production_environment(self) -> "Settings":
        env = (self.ENVIRONMENT or "").strip().lower()
        if env not in {"development", "test"}:
            if self.ENABLE_DEV_LOGIN:
                raise ValueError("ENABLE_DEV_LOGIN must be False in non-development environments.")
            if not self.GITHUB_CLIENT_ID or not self.GITHUB_CLIENT_ID.strip():
                raise ValueError("GITHUB_CLIENT_ID must be set in non-development environments.")
            if not self.GITHUB_CLIENT_SECRET or not self.GITHUB_CLIENT_SECRET.strip():
                raise ValueError("GITHUB_CLIENT_SECRET must be set in non-development environments.")
            if not self.GITHUB_TOKEN_ENCRYPTION_KEY or not self.GITHUB_TOKEN_ENCRYPTION_KEY.strip():
                raise ValueError("GITHUB_TOKEN_ENCRYPTION_KEY must be set in non-development environments.")
            if not self.FRONTEND_URL.startswith("https://"):
                raise ValueError("FRONTEND_URL must use https:// in non-development environments.")
            if not self.GITHUB_CALLBACK_URL.startswith("https://"):
                raise ValueError("GITHUB_CALLBACK_URL must use https:// in non-development environments.")
            if any("localhost" in origin.lower() or "127.0.0.1" in origin for origin in self.CORS_ORIGINS):
                raise ValueError("CORS_ORIGINS must not contain localhost or 127.0.0.1 in non-development environments.")
            if self.SESSION_COOKIE_SECURE is False:
                raise ValueError("SESSION_COOKIE_SECURE must be None or True in non-development environments.")
        return self

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
