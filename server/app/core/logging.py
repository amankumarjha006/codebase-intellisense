import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict

from app.core.config import settings

# Global context variable for request ID
request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")

class JSONLogFormatter(logging.Formatter):
    """
    Custom formatter that outputs logs as structured JSON.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_record: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx_var.get(),
        }

        # Add exception info if present
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
            
        # Add extra properties passed in the 'extra' kwarg
        if hasattr(record, "extra"):
            log_record["extra"] = record.extra

        # Safely include arbitrary kwargs that were injected into the record
        # (excluding standard LogRecord attributes)
        standard_attrs = {
            "args", "asctime", "created", "exc_info", "exc_text", "filename",
            "funcName", "id", "levelname", "levelno", "lineno", "module",
            "msecs", "message", "msg", "name", "pathname", "process",
            "processName", "relativeCreated", "stack_info", "thread", "threadName",
            "taskName"
        }
        for key, value in record.__dict__.items():
            if key not in standard_attrs and key != "extra":
                log_record[key] = value

        return json.dumps(log_record)

class StandardLogFormatter(logging.Formatter):
    """
    Standard text formatter that includes request_id.
    """
    def format(self, record: logging.LogRecord) -> str:
        req_id = request_id_ctx_var.get()
        prefix = f"[{req_id}] " if req_id else ""
        record.msg = f"{prefix}{record.msg}"
        return super().format(record)

def setup_logging() -> None:
    """
    Configures the root logger based on settings.
    """
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Remove existing handlers to avoid duplicates
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
        
    console_handler = logging.StreamHandler(sys.stdout)
    
    if settings.LOG_FORMAT.lower() == "json":
        console_handler.setFormatter(JSONLogFormatter())
    else:
        fmt = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        console_handler.setFormatter(StandardLogFormatter(fmt))
        
    root_logger.addHandler(console_handler)
    
    # Mute noisy third-party loggers if necessary
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
