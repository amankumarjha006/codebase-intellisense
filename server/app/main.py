from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.api import api_router
from app.api.deps import AuthException, NotFoundException
from fastapi.responses import JSONResponse
from fastapi import Request
import logging
import time

from app.core.logging import setup_logging
from app.api.middleware.observability import ObservabilityMiddleware

# Setup structured logging
setup_logging()

# Add Observability middleware
app.add_middleware(ObservabilityMiddleware)

logger = logging.getLogger(__name__)

@app.exception_handler(AuthException)
async def auth_exception_handler(request: Request, exc: AuthException):
    logger.warning(
        "auth_exception",
        extra={
            "code": exc.code,
            "error": exc.message,
            "status_code": exc.status_code,
            "route": request.url.path,
        }
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message
            }
        }
    )

@app.exception_handler(NotFoundException)
async def not_found_exception_handler(request: Request, exc: NotFoundException):
    logger.info(
        "not_found_exception",
        extra={
            "code": exc.code,
            "error": exc.message,
            "status_code": exc.status_code,
            "route": request.url.path,
        }
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message
            }
        }
    )

from app.core.rate_limit import RateLimitException, RateLimitInfrastructureException

@app.exception_handler(RateLimitException)
async def rate_limit_exception_handler(request: Request, exc: RateLimitException):
    return JSONResponse(
        status_code=429,
        content={"detail": exc.message, "code": "RATE_LIMIT_EXCEEDED"},
        headers={
            "Retry-After": str(exc.reset),
            "X-RateLimit-Limit": str(exc.limit),
            "X-RateLimit-Remaining": str(exc.remaining),
            "X-RateLimit-Reset": str(int(time.time() + exc.reset))
        }
    )

@app.exception_handler(RateLimitInfrastructureException)
async def rate_limit_infra_exception_handler(request: Request, exc: RateLimitInfrastructureException):
    return JSONResponse(
        status_code=503,
        content={"detail": exc.message, "code": "SERVICE_UNAVAILABLE"}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "unhandled_exception",
        extra={
            "error": type(exc).__name__,
            "message": str(exc),
            "route": request.url.path,
        },
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred."
            }
        }
    )

@app.get("/health", tags=["health"])
def health_check():
    """Simple foundation health check endpoint."""
    return {"status": "ok"}

app.include_router(api_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
