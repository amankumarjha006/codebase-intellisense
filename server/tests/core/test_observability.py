import json
import logging
from unittest.mock import MagicMock
import uuid

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.api.middleware.observability import ObservabilityMiddleware
from app.core.logging import JSONLogFormatter, request_id_ctx_var

# Setup test app for middleware testing
app = FastAPI()
app.add_middleware(ObservabilityMiddleware)

@app.get("/test/success")
async def success_endpoint():
    return {"status": "ok"}

@app.get("/test/error")
async def error_endpoint():
    raise ValueError("Test error")

@app.get("/test/conversations/{conversation_id}")
async def conv_endpoint(conversation_id: str):
    return {"conv_id": conversation_id}


def test_middleware_generates_request_id(caplog):
    caplog.set_level(logging.INFO)
    client = TestClient(app)
    
    response = client.get("/test/success")
    assert response.status_code == 200
    
    # Verify header is returned
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert len(req_id) > 0
    
    # Verify log was generated
    record = next((r for r in caplog.records if r.message == "request_completed"), None)
    assert record is not None
    assert getattr(record, "status", None) == 200
    assert getattr(record, "duration_ms", None) is not None

def test_middleware_preserves_request_id(caplog):
    caplog.set_level(logging.INFO)
    client = TestClient(app)
    
    custom_id = "test-req-id-123"
    response = client.get("/test/success", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    
    # Verify header is returned and preserved
    assert response.headers.get("X-Request-ID") == custom_id

def test_middleware_logs_exception(caplog):
    caplog.set_level(logging.ERROR)
    client = TestClient(app)
    
    with pytest.raises(ValueError, match="Test error"):
        client.get("/test/error")
        
    record = next((r for r in caplog.records if r.message == "request_failed"), None)
    assert record is not None
    assert getattr(record, "error", None) == "Test error"
    assert getattr(record, "duration_ms", None) is not None

def test_middleware_logs_path_params(caplog):
    caplog.set_level(logging.INFO)
    client = TestClient(app)
    
    conv_id = str(uuid.uuid4())
    client.get(f"/test/conversations/{conv_id}")
    
    record = next((r for r in caplog.records if r.message == "request_completed"), None)
    assert record is not None
    assert getattr(record, "conversation_id", None) == conv_id

def test_json_formatter_safety():
    """Verify JSON formatter handles sensitive data safely.
    Actually, we just test that it formats to valid JSON and extracts context."""
    formatter = JSONLogFormatter()
    
    # Set context
    token = request_id_ctx_var.set("req-123")
    
    try:
        record = logging.LogRecord(
            name="test_logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="test message",
            args=(),
            exc_info=None
        )
        record.sensitive_data = "password123"  # If extra fields are passed directly
        
        output = formatter.format(record)
        data = json.loads(output)
        
        assert data["message"] == "test message"
        assert data["request_id"] == "req-123"
        assert data["level"] == "INFO"
        assert data["sensitive_data"] == "password123"
        
        # In a real setup, we would filter sensitive keys. For this phase,
        # we just ensure we don't log them in our code.
    finally:
        request_id_ctx_var.reset(token)
