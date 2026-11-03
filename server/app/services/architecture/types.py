"""Data structures for architecture import resolution and coverage."""

from dataclasses import dataclass, field
from typing import Callable, Literal, Optional

ImportKind = Literal["internal", "external", "unresolved"]
FileReader = Callable[[str], str]


@dataclass(frozen=True)
class ImportEvidence:
    """An imported dependency occurrence in a source file."""

    source_file: str
    target_file: Optional[str]  # None if external or unresolved
    specifier: str
    line_number: int
    kind: ImportKind
    symbol: Optional[str] = None


@dataclass
class ResolutionCoverage:
    """Import resolution statistics across a repository analysis run."""

    files_parsed: int
    internal_imports_total: int
    internal_resolved: int
    internal_unresolved: int
    internal_resolution_ratio: float
    external_imports_count: int
    unparseable_files: list[str] = field(default_factory=list)
    languages_analyzed: list[str] = field(default_factory=list)
    languages_not_analyzed: list[str] = field(default_factory=list)
    unresolved_specifiers: list[tuple[str, str]] = field(default_factory=list)  # (specifier, source_file)
    wall_clock_seconds: float = 0.0
    peak_memory_mb: Optional[float] = None

