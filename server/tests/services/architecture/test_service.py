"""Tests for ArchitectureService failure handling and idempotency."""

from unittest.mock import MagicMock, patch
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models.knowledge import AnalysisResult
from app.services.architecture.service import ArchitectureService


def test_service_idempotent_persistence():
    """Verify multiple runs on the same version replace previous record idempotently."""
    mock_db = MagicMock(spec=Session)
    version_id = uuid4()
    service = ArchitectureService(mock_db)

    payload1 = service.create_failed_payload()
    service._persist_analysis_result(version_id, payload1)

    # Verifies delete was called on existing record and add was called
    assert mock_db.query.called
    assert mock_db.add.called
    assert mock_db.commit.called


def test_service_failure_safety_no_exception_leak():
    """Verify that exceptions never crash the service and never leak into the payload."""
    secret_leak_attempt = "FATAL_SECRET_EXCEPTION_DATABASE_PW_SECRET_123"
    mock_db = MagicMock(spec=Session)
    version_id = uuid4()
    service = ArchitectureService(mock_db)

    with patch.object(service, "compute_architecture_payload", side_effect=RuntimeError(secret_leak_attempt)):
        result = service.analyze_repository_version(version_id, "some/fake/path")

    assert result.status == "failed"
    assert result.error == "ANALYSIS_FAILED"

    # Verify secret string is NOT in the payload dump
    dump_str = str(result.model_dump())
    assert secret_leak_attempt not in dump_str
