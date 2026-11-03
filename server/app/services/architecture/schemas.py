"""Pydantic schemas for Architecture V2 analysis."""

from datetime import datetime, timezone
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class SystemNode(BaseModel):
    """A node in the system map derived from manifests."""

    id: str
    name: str
    kind: str  # "service", "container", "runtime", "external_deps", "config"
    metadata: dict[str, Any] = Field(default_factory=dict)
    source_file: str
    line_number: int

    model_config = ConfigDict(from_attributes=True)


class SystemEdge(BaseModel):
    """A dependency edge in the system map."""

    source: str
    target: str
    label: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SystemMapOut(BaseModel):
    """System map showing what runs and what it talks to."""

    nodes: list[SystemNode] = Field(default_factory=list)
    edges: list[SystemEdge] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ComponentOut(BaseModel):
    """A logical component aggregating files by directory."""

    id: str
    name: str
    path_prefix: str
    file_count: int
    language_mix: dict[str, int]
    layer: int = 0
    summary: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EvidenceItem(BaseModel):
    """Citation evidence for a dependency edge between components."""

    source_path: str
    target_path: str
    line: int

    model_config = ConfigDict(from_attributes=True)


class GraphEdgeOut(BaseModel):
    """Aggregated resolved dependency edge between two components."""

    source: str
    target: str
    weight: int
    kind: str = "internal"
    cycle: bool = False
    evidence: list[EvidenceItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FlowCitation(BaseModel):
    """Code citation for a step in a data flow."""

    file_path: str
    start_line: int
    end_line: int

    model_config = ConfigDict(from_attributes=True)


class FlowStep(BaseModel):
    """A step in an end-to-end data flow."""

    component_id: str
    caption: Optional[str] = None
    citations: list[FlowCitation] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FlowEntry(BaseModel):
    """Entrypoint trigger for a data flow."""

    kind: str  # "http_route", "cli", "event"
    method: str  # "GET", "POST", etc.
    path: str  # "/repositories/{id}"
    file: str
    line: int

    model_config = ConfigDict(from_attributes=True)


class DataFlowOut(BaseModel):
    """A traced data flow through architectural components."""

    id: str
    title: str
    entry: FlowEntry
    steps: list[FlowStep] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CoverageUnanalyzedLanguage(BaseModel):
    """File count for a language that lacks an import resolver."""

    language: str
    files: int

    model_config = ConfigDict(from_attributes=True)


class CoverageOut(BaseModel):
    """Resolution coverage statistics."""

    internal_imports_total: int
    resolved: int
    ratio: float
    languages_analyzed: list[str] = Field(default_factory=list)
    languages_not_analyzed: list[CoverageUnanalyzedLanguage] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LimitsOut(BaseModel):
    """Graph and component limits applied during analysis."""

    truncated: bool = False
    max_components: int = 40

    model_config = ConfigDict(from_attributes=True)


class ArchitectureOut(BaseModel):
    """Complete evidence-based Architecture V2 analysis payload."""

    schema_version: int = 2
    status: Literal["ready", "partial", "failed"] = "ready"
    system: SystemMapOut = Field(default_factory=SystemMapOut)
    components: list[ComponentOut] = Field(default_factory=list)
    edges: list[GraphEdgeOut] = Field(default_factory=list)
    flows: list[DataFlowOut] = Field(default_factory=list)
    coverage: CoverageOut
    limits: LimitsOut = Field(default_factory=LimitsOut)
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    error: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ComponentFileItem(BaseModel):
    """File belonging to an architectural component."""

    path: str
    language: str
    size_bytes: int

    model_config = ConfigDict(from_attributes=True)


class ComponentFilesOut(BaseModel):
    """Paginated list of files belonging to a component."""

    component_id: str
    total: int
    page: int
    limit: int
    files: list[ComponentFileItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

