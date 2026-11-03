"""Architecture analysis pipeline service."""

from collections import defaultdict
import logging
from pathlib import Path
from typing import Callable, Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge import AnalysisResult, File
from .components import group_files_into_components
from .enrichment import enrich_architecture_payload
from .flows import trace_data_flows
from .graph import build_architecture_graph
from .manifests import build_system_map
from .reader import create_repo_reader
from .runner import analyze_repository_imports
from .schemas import (
    ArchitectureOut,
    CoverageOut,
    CoverageUnanalyzedLanguage,
    LimitsOut,
    SystemMapOut,
)

logger = logging.getLogger(__name__)


class ArchitectureService:
    """Service for running the end-to-end architecture analysis pipeline."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def analyze_repository_version(
        self,
        repository_version_id: UUID,
        repo_path: str | Path,
    ) -> ArchitectureOut:
        """Run architecture analysis and idempotently persist result to database."""
        try:
            payload = self.compute_architecture_payload(
                repository_version_id=repository_version_id,
                repo_path=repo_path,
            )
            # LLM enrichment (exactly ONE call per version)
            if settings.ARCHITECTURE_LLM_ENRICHMENT_ENABLED and payload.status != "failed":
                try:
                    from app.services.llm.factory import create_llm_provider
                    llm_provider = create_llm_provider(settings)
                    payload = enrich_architecture_payload(payload, repo_path, llm_provider)
                except Exception:
                    logger.warning("LLM provider creation failed; continuing with un-enriched payload", exc_info=False)
        except Exception:
            logger.exception("Architecture analysis pipeline failed unexpectedly")
            payload = self.create_failed_payload()

        # Idempotent database persistence
        self._persist_analysis_result(repository_version_id, payload)
        return payload

    def compute_architecture_payload(
        self,
        repository_version_id: UUID,
        repo_path: str | Path,
    ) -> ArchitectureOut:
        """Pure compute step for architecture analysis."""
        # 1. Fetch file set from database for this version
        db_files = (
            self.db.query(File.file_path, File.language, File.size_bytes)
            .filter(File.repository_version_id == repository_version_id)
            .order_by(File.file_path)
            .all()
        )

        files_tuple = [(f[0], f[1], f[2]) for f in db_files]
        files_index = [(f[0], f[1]) for f in db_files]

        # 2. Injected secure file reader
        reader = create_repo_reader(repo_path)

        # 3. Import resolution & coverage
        cov, evidences = analyze_repository_imports(
            files=files_index,
            read_file=reader,
        )

        # 4. Collapse files into components
        components, file_to_component = group_files_into_components(files_tuple)

        # 5. Build graph, cycles, layers, and edge cap
        edges, truncated = build_architecture_graph(
            components=components,
            file_to_component=file_to_component,
            evidences=evidences,
        )

        # 6. Extract System Map from manifests
        system_map = build_system_map(files_index, reader)

        # 7. Trace Data Flows from route handlers
        flows = trace_data_flows(
            files=files_index,
            read_file=reader,
            components=components,
            file_to_component=file_to_component,
            edges=edges,
        )

        # 8. Compute unanalyzed languages breakdown
        unanalyzed_counts: dict[str, int] = defaultdict(int)
        for _, lang in files_index:
            lang_lower = lang.lower()
            if lang_lower in cov.languages_not_analyzed:
                unanalyzed_counts[lang] += 1

        not_analyzed_items = [
            CoverageUnanalyzedLanguage(language=lang, files=count)
            for lang, count in sorted(unanalyzed_counts.items(), key=lambda x: -x[1])
        ]

        coverage_out = CoverageOut(
            internal_imports_total=cov.internal_imports_total,
            resolved=cov.internal_resolved,
            ratio=cov.internal_resolution_ratio,
            languages_analyzed=cov.languages_analyzed,
            languages_not_analyzed=not_analyzed_items,
        )

        status = "ready"
        if cov.internal_imports_total > 0 and cov.internal_resolution_ratio < 0.5:
            status = "partial"

        return ArchitectureOut(
            schema_version=2,
            status=status,
            system=system_map,
            components=components,
            edges=edges,
            flows=flows,
            coverage=coverage_out,
            limits=LimitsOut(truncated=truncated, max_components=40),
            error=None,
        )

    def create_failed_payload(self) -> ArchitectureOut:
        """Generate safe failed payload with no exception text."""
        return ArchitectureOut(
            schema_version=2,
            status="failed",
            system=SystemMapOut(nodes=[], edges=[]),
            components=[],
            edges=[],
            flows=[],
            coverage=CoverageOut(
                internal_imports_total=0,
                resolved=0,
                ratio=0.0,
                languages_analyzed=[],
                languages_not_analyzed=[],
            ),
            limits=LimitsOut(truncated=False, max_components=40),
            error="ANALYSIS_FAILED",
        )

    def _persist_analysis_result(
        self,
        repository_version_id: UUID,
        payload: ArchitectureOut,
    ) -> None:
        """Idempotently save architecture analysis result."""
        # Delete existing ARCHITECTURE record if any
        self.db.query(AnalysisResult).filter(
            AnalysisResult.repository_version_id == repository_version_id,
            AnalysisResult.analysis_type == "ARCHITECTURE",
        ).delete()

        analysis = AnalysisResult(
            repository_version_id=repository_version_id,
            analysis_type="ARCHITECTURE",
            payload=payload.model_dump(),
        )
        self.db.add(analysis)
        self.db.commit()

