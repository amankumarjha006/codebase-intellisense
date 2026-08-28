from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger("uvicorn.error")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def check_db_connection() -> bool:
    """Verifies connection to PostgreSQL database."""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.warning(f"Database connection check failed: {e}")
        return False

def check_pgvector_extension() -> bool:
    """Verifies availability of pgvector extension in PostgreSQL."""
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT count(*) FROM pg_extension WHERE extname = 'vector'")
            )
            return (result.scalar() or 0) > 0
    except Exception as e:
        logger.warning(f"pgvector extension check failed: {e}")
        return False
