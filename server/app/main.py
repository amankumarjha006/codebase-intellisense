from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from typing import Optional
import logging
import subprocess
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from app.core.logging import setup_logging
setup_logging()
logger = logging.getLogger(__name__)

_worker_thread: Optional[threading.Thread] = None
_worker_stop_event: Optional[threading.Event] = None


def _run_worker_supervisor(stop_event: threading.Event) -> None:
    """Supervises the background indexing worker process.

    Spawns the worker as an isolated OS subprocess to protect FastAPI's GIL
    and event loop, and automatically restarts it if it unexpectedly exits.
    """
    server_dir = str(Path(__file__).resolve().parent.parent)
    logger.info("Embedded indexing worker supervisor started.")

    while not stop_event.is_set():
        try:
            logger.info("Spawning embedded indexing worker process...")
            proc = subprocess.Popen(
                [sys.executable, "-m", "app.workers.indexing_worker"],
                cwd=server_dir,
            )
            logger.info("Embedded indexing worker spawned with PID %s", proc.pid)

            while not stop_event.is_set():
                ret = proc.poll()
                if ret is not None:
                    if not stop_event.is_set():
                        logger.warning(
                            "Indexing worker process (PID %s) exited with code %s. Restarting in 5s...",
                            proc.pid,
                            ret,
                        )
                        time.sleep(5)
                    break
                time.sleep(1)

            if stop_event.is_set() and proc.poll() is None:
                logger.info("Stopping embedded indexing worker (PID %s)...", proc.pid)
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    logger.warning("Worker did not exit within 10s, killing PID %s...", proc.pid)
                    proc.kill()
                    proc.wait()
                logger.info("Embedded indexing worker stopped cleanly.")
        except Exception as e:
            logger.error("Error in embedded worker supervisor: %s", e, exc_info=True)
            if not stop_event.is_set():
                time.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_thread, _worker_stop_event
    should_run = getattr(settings, "ENABLE_EMBEDDED_WORKER", True) and settings.ENVIRONMENT != "test"
    if should_run:
        _worker_stop_event = threading.Event()
        _worker_thread = threading.Thread(
            target=_run_worker_supervisor,
            args=(_worker_stop_event,),
            daemon=True,
            name="IndexingWorkerSupervisor",
        )
        _worker_thread.start()

    yield

    if _worker_stop_event:
        _worker_stop_event.set()
    if _worker_thread and _worker_thread.is_alive():
        _worker_thread.join(timeout=12)


def get_docs_urls(env: str, enable_api_docs: bool = False) -> tuple[Optional[str], Optional[str], Optional[str]]:
    is_dev_or_test = (env or "").strip().lower() in {"development", "test"}
    if is_dev_or_test or enable_api_docs:
        return f"{settings.API_V1_STR}/openapi.json", "/docs", "/redoc"
    return None, None, None

_openapi_url, _docs_url, _redoc_url = get_docs_urls(
    settings.ENVIRONMENT,
    getattr(settings, "ENABLE_API_DOCS", False),
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=_openapi_url,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    lifespan=lifespan,
)

from urllib.parse import urlparse

# Compute allowed origins from CORS_ORIGINS setting and FRONTEND_URL
_origins_set = set(getattr(settings, "CORS_ORIGINS", []) or [])
_frontend_url = getattr(settings, "FRONTEND_URL", None)
if _frontend_url:
    _parsed_frontend = urlparse(_frontend_url)
    _frontend_origin = (
        f"{_parsed_frontend.scheme}://{_parsed_frontend.netloc}"
        if _parsed_frontend and _parsed_frontend.netloc
        else _frontend_url
    )
    _origins_set.add(_frontend_origin)

if not _origins_set:
    _origins_set = {"http://localhost:3000", "http://127.0.0.1:3000"}

_allow_origins = sorted(list(_origins_set))

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Retry-After"],
)

from app.api.v1.api import api_router
from app.api.deps import AuthException, NotFoundException
from fastapi.responses import JSONResponse
from fastapi import Request
import time

from app.core.logging import request_id_ctx_var
from app.api.middleware.observability import ObservabilityMiddleware

# Add Observability middleware
app.add_middleware(ObservabilityMiddleware)

def _get_request_id(request: Request) -> Optional[str]:
    return (
        getattr(request.state, "request_id", None)
        or request_id_ctx_var.get()
        or request.headers.get(settings.REQUEST_ID_HEADER)
    )

@app.exception_handler(AuthException)
async def auth_exception_handler(request: Request, exc: AuthException):
    req_id = _get_request_id(request)
    logger.warning(
        "auth_exception",
        extra={
            "code": exc.code,
            "error_detail": exc.message,
            "status_code": exc.status_code,
            "route": request.url.path,
            "request_id": req_id,
        }
    )
    content = {
        "error": {
            "code": exc.code,
            "message": exc.message
        }
    }
    if req_id:
        content["error"]["request_id"] = req_id
    return JSONResponse(status_code=exc.status_code, content=content)

@app.exception_handler(NotFoundException)
async def not_found_exception_handler(request: Request, exc: NotFoundException):
    req_id = _get_request_id(request)
    logger.info(
        "not_found_exception",
        extra={
            "code": exc.code,
            "error_detail": exc.message,
            "status_code": exc.status_code,
            "route": request.url.path,
            "request_id": req_id,
        }
    )
    content = {
        "error": {
            "code": exc.code,
            "message": exc.message
        }
    }
    if req_id:
        content["error"]["request_id"] = req_id
    return JSONResponse(status_code=exc.status_code, content=content)

from app.core.rate_limit import RateLimitException, RateLimitInfrastructureException

@app.exception_handler(RateLimitException)
async def rate_limit_exception_handler(request: Request, exc: RateLimitException):
    req_id = _get_request_id(request)
    content = {
        "error": {
            "code": "RATE_LIMIT_EXCEEDED",
            "message": "Too many requests. Please wait a moment."
        },
        "detail": exc.message,
        "code": "RATE_LIMIT_EXCEEDED"
    }
    if req_id:
        content["error"]["request_id"] = req_id
    return JSONResponse(
        status_code=429,
        content=content,
        headers={
            "Retry-After": str(exc.reset),
            "X-RateLimit-Limit": str(exc.limit),
            "X-RateLimit-Remaining": str(exc.remaining),
            "X-RateLimit-Reset": str(int(time.time() + exc.reset))
        }
    )

@app.exception_handler(RateLimitInfrastructureException)
async def rate_limit_infra_exception_handler(request: Request, exc: RateLimitInfrastructureException):
    req_id = _get_request_id(request)
    content = {
        "error": {
            "code": "SERVICE_UNAVAILABLE",
            "message": "Service temporarily unavailable. Please try again."
        },
        "detail": "Service temporarily unavailable. Please try again.",
        "code": "SERVICE_UNAVAILABLE"
    }
    if req_id:
        content["error"]["request_id"] = req_id
    return JSONResponse(status_code=503, content=content)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = _get_request_id(request)
    logger.error(
        "unhandled_exception",
        extra={
            "error_type": type(exc).__name__,
            "error_detail": str(exc),
            "route": request.url.path,
            "request_id": req_id,
        },
        exc_info=True
    )
    content = {
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred."
        }
    }
    if req_id:
        content["error"]["request_id"] = req_id
    return JSONResponse(status_code=500, content=content)

@app.get("/health", tags=["health"])
def health_check():
    """Simple foundation health check endpoint."""
    return {"status": "ok"}

import asyncio
from sqlalchemy import text
from app.core.db import engine
from app.core.redis import get_redis_client

@app.get("/ready", tags=["health"])
async def readiness_check():
    """Readiness probe checking PostgreSQL and Redis with 2s timeouts."""
    failed: list[str] = []

    # Check PostgreSQL: SELECT 1 with 2s timeout
    try:
        def _check_postgres():
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))

        await asyncio.wait_for(asyncio.to_thread(_check_postgres), timeout=2.0)
    except Exception as exc:
        logger.warning(f"Readiness check failed for postgres: {type(exc).__name__}")
        failed.append("postgres")

    # Check Redis: PING with 2s timeout
    try:
        redis_client = await get_redis_client()
        pong = await asyncio.wait_for(redis_client.ping(), timeout=2.0)
        if not pong:
            failed.append("redis")
    except Exception as exc:
        logger.warning(f"Readiness check failed for redis: {type(exc).__name__}")
        failed.append("redis")

    if failed:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "checks": {
                    "postgres": "failed" if "postgres" in failed else "ok",
                    "redis": "failed" if "redis" in failed else "ok",
                },
                "failed": failed,
            },
        )

    return {
        "status": "ready",
        "checks": {
            "postgres": "ok",
            "redis": "ok",
        },
    }

app.include_router(api_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
