import logging
import time
import uuid
from typing import Callable, Awaitable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import request_id_ctx_var

logger = logging.getLogger(__name__)

class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # Extract or generate request ID
        req_id = request.headers.get(settings.REQUEST_ID_HEADER)
        if not req_id:
            req_id = str(uuid.uuid4())
            
        # Set context var for structured logger
        token = request_id_ctx_var.set(req_id)
        
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Identify contextual IDs safely from the path if they exist
            # Note: We do not parse auth headers here to avoid breaking downstream auth
            conv_id = request.path_params.get("conversation_id")
            repo_id = request.path_params.get("repository_id")
            
            log_data = {
                "method": request.method,
                "route": request.url.path,
                "status": response.status_code,
                "duration_ms": round(duration_ms, 2),
            }
            if conv_id:
                log_data["conversation_id"] = conv_id
            if repo_id:
                log_data["repository_id"] = repo_id
                
            logger.info("request_completed", extra=log_data)
            
            # Inject header back to client
            response.headers[settings.REQUEST_ID_HEADER] = req_id
            
            return response
            
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            # Exceptions will be caught by global handlers if they are mapped,
            # but unhandled ones might bubble up here.
            # FastApi handles most before this, but just in case:
            logger.error(
                "request_failed",
                extra={
                    "method": request.method,
                    "route": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                    "error": str(e)
                },
                exc_info=True
            )
            raise
        finally:
            request_id_ctx_var.reset(token)
