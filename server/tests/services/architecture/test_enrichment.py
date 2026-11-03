"""Tests for Architecture LLM enrichment."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import settings
from app.services.architecture.enrichment import (
    _extract_readme_snippet,
    _sanitize_text,
    enrich_architecture_payload,
)
from app.services.architecture.schemas import (
    ArchitectureOut,
    ComponentOut,
    CoverageOut,
    DataFlowOut,
    FlowCitation,
    FlowEntry,
    FlowStep,
    LimitsOut,
    SystemMapOut,
)


def _create_sample_payload() -> ArchitectureOut:
    return ArchitectureOut(
        schema_version=2,
        status="ready",
        system=SystemMapOut(nodes=[], edges=[]),
        components=[
            ComponentOut(
                id="comp:backend",
                name="backend",
                path_prefix="server/app",
                file_count=10,
                language_mix={"Python": 10},
                layer=1,
                summary=None,
            ),
            ComponentOut(
                id="comp:frontend",
                name="frontend",
                path_prefix="client/src",
                file_count=15,
                language_mix={"TypeScript": 15},
                layer=0,
                summary=None,
            ),
        ],
        edges=[],
        flows=[
            DataFlowOut(
                id="flow:get_repos",
                title="GET /repositories",
                entry=FlowEntry(
                    kind="http_route",
                    method="GET",
                    path="/repositories",
                    file="server/app/api/v1/endpoints/repositories.py",
                    line=42,
                ),
                steps=[
                    FlowStep(
                        component_id="comp:backend",
                        caption=None,
                        citations=[
                            FlowCitation(
                                file_path="server/app/api/v1/endpoints/repositories.py",
                                start_line=42,
                                end_line=50,
                            )
                        ],
                    )
                ],
            )
        ],
        coverage=CoverageOut(
            internal_imports_total=10,
            resolved=10,
            ratio=1.0,
            languages_analyzed=["Python"],
            languages_not_analyzed=[],
        ),
        limits=LimitsOut(truncated=False, max_components=40),
        error=None,
    )


def test_sanitize_text():
    raw = "<b>Summary</b> with <script>evil()</script> and https://example.com/test link."
    clean = _sanitize_text(raw, max_length=50)
    assert "<b>" not in clean
    assert "https://" not in clean
    assert clean == "Summary with evil() and link."

    long_text = "a" * 300
    capped = _sanitize_text(long_text, max_length=200)
    assert len(capped) == 200


def test_enrichment_success(tmp_path):
    (tmp_path / "README.md").write_text("# Test Repo\nA great project.", encoding="utf-8")
    payload = _create_sample_payload()

    mock_provider = MagicMock()
    mock_provider.generate = AsyncMock(
        return_value=json.dumps(
            {
                "components": {
                    "comp:backend": "Core FastAPI backend service handling data persistence.",
                    "comp:frontend": "Client React SPA handling UI rendering.",
                },
                "flow_steps": {
                    "flow:get_repos:0": "Endpoint validates user session and queries database.",
                },
            }
        )
    )

    with patch.object(settings, "ARCHITECTURE_LLM_ENRICHMENT_ENABLED", True):
        enriched = enrich_architecture_payload(payload, tmp_path, mock_provider)

    assert enriched.components[0].summary == "Core FastAPI backend service handling data persistence."
    assert enriched.components[1].summary == "Client React SPA handling UI rendering."
    assert enriched.flows[0].steps[0].caption == "Endpoint validates user session and queries database."
    # Exactly one LLM call
    assert mock_provider.generate.call_count == 1


def test_enrichment_unknown_ids_rejected(tmp_path):
    payload = _create_sample_payload()
    mock_provider = MagicMock()
    mock_provider.generate = AsyncMock(
        return_value=json.dumps(
            {
                "components": {
                    "comp:nonexistent": "Hacker component injected.",
                    "comp:backend": "Legitimate backend service.",
                },
                "flow_steps": {
                    "flow:fake:99": "Bogus step.",
                    "flow:get_repos:0": "Legitimate route step.",
                },
            }
        )
    )

    with patch.object(settings, "ARCHITECTURE_LLM_ENRICHMENT_ENABLED", True):
        enriched = enrich_architecture_payload(payload, tmp_path, mock_provider)

    assert enriched.components[0].summary == "Legitimate backend service."
    assert enriched.components[1].summary is None
    assert enriched.flows[0].steps[0].caption == "Legitimate route step."


def test_enrichment_invalid_json(tmp_path):
    payload = _create_sample_payload()
    mock_provider = MagicMock()
    mock_provider.generate = AsyncMock(return_value="I cannot output JSON sorry.")

    with patch.object(settings, "ARCHITECTURE_LLM_ENRICHMENT_ENABLED", True):
        enriched = enrich_architecture_payload(payload, tmp_path, mock_provider)

    # Summaries remain None, status unchanged
    assert enriched.components[0].summary is None
    assert enriched.flows[0].steps[0].caption is None
    assert enriched.status == "ready"


def test_enrichment_provider_exception(tmp_path):
    payload = _create_sample_payload()
    mock_provider = MagicMock()
    mock_provider.generate = AsyncMock(side_effect=RuntimeError("Rate limit / 429 quota exceeded"))

    with patch.object(settings, "ARCHITECTURE_LLM_ENRICHMENT_ENABLED", True):
        enriched = enrich_architecture_payload(payload, tmp_path, mock_provider)

    assert enriched.components[0].summary is None
    assert enriched.status == "ready"
    assert enriched.error is None


def test_enrichment_disabled_by_config(tmp_path):
    payload = _create_sample_payload()
    mock_provider = MagicMock()
    mock_provider.generate = AsyncMock()

    with patch.object(settings, "ARCHITECTURE_LLM_ENRICHMENT_ENABLED", False):
        enriched = enrich_architecture_payload(payload, tmp_path, mock_provider)

    assert mock_provider.generate.call_count == 0
    assert enriched.components[0].summary is None

