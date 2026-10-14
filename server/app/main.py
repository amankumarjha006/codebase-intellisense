from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

from urllib.parse import urlparse
from typing import Optional

# Compute allowed origins from existing configured FRONTEND_URL setting
_frontend_url = getattr(settings, "FRONTEND_URL", None)
if _frontend_url:
    _parsed_frontend = urlparse(_frontend_url)
    _frontend_origin = (
        f"{_parsed_frontend.scheme}://{_parsed_frontend.netloc}"
        if _parsed_frontend and _parsed_frontend.netloc
        else _frontend_url
    )
    _allow_origins = [_frontend_origin]
else:
    _allow_origins = ["http://localhost:3000"]

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
import logging
import time

from app.core.logging import setup_logging, request_id_ctx_var
from app.api.middleware.observability import ObservabilityMiddleware

# Setup structured logging
setup_logging()

# Add Observability middleware
app.add_middleware(ObservabilityMiddleware)

logger = logging.getLogger(__name__)

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

app.include_router(api_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
