"""Pipeline runner for repository import analysis and resolution coverage."""

import os
from pathlib import Path
import time
import tracemalloc
from typing import Callable, Sequence

from .reader import create_repo_reader
from .resolvers.javascript import JavaScriptResolver
from .resolvers.python import PythonResolver
from .types import FileReader, ImportEvidence, ResolutionCoverage

DEFAULT_SKIP_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    ".tox",
    ".eggs",
}


def discover_repo_files(repo_path: str | Path, skip_dirs: set[str] | None = None) -> list[tuple[str, str]]:
    """Discover files in repo and infer language."""
    base = Path(repo_path).resolve()
    skip = skip_dirs or DEFAULT_SKIP_DIRS
    discovered: list[tuple[str, str]] = []

    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in skip and not d.startswith(".")]
        for f in files:
            full = Path(root) / f
            try:
                rel = full.relative_to(base).as_posix()
            except ValueError:
                continue

            lang = infer_file_language(rel)
            discovered.append((rel, lang))

    return discovered


def infer_file_language(path: str) -> str:
    """Infer file language from extension."""
    lower = path.lower()
    if lower.endswith(".py"):
        return "python"
    elif lower.endswith(".tsx"):
        return "tsx"
    elif lower.endswith(".ts"):
        return "typescript"
    elif lower.endswith(".jsx"):
        return "jsx"
    elif lower.endswith((".js", ".mjs", ".cjs")):
        return "javascript"
    elif lower.endswith(".json"):
        return "json"
    elif lower.endswith((".yaml", ".yml")):
        return "yaml"
    elif lower.endswith((".md", ".mdx")):
        return "markdown"
    return "other"


def analyze_repository_imports(
    repo_path: str | Path | None = None,
    files: Sequence[tuple[str, str]] | None = None,
    read_file: FileReader | None = None,
    clock: Callable[[], float] | None = None,
    timeout_seconds: float = 60.0,
) -> tuple[ResolutionCoverage, list[ImportEvidence]]:
    """Run pure import resolvers and compute resolution coverage metrics."""
    clock_fn = clock or time.monotonic
    start_time = clock_fn()

    tracemalloc.start()

    if repo_path is not None:
        if files is None:
            files = discover_repo_files(repo_path)
        if read_file is None:
            read_file = create_repo_reader(repo_path)

    if files is None or read_file is None:
        raise ValueError("Either repo_path or both files and read_file must be provided")

    evidences: list[ImportEvidence] = []
    unparseable_files: list[str] = []
    languages_analyzed: set[str] = set()
    languages_not_analyzed: set[str] = set()

    # Partition files by resolver
    py_files: list[tuple[str, str]] = []
    js_files: list[tuple[str, str]] = []

    for rel_path, lang in files:
        lang_lower = lang.lower()
        if lang_lower == "python" or rel_path.endswith(".py"):
            py_files.append((rel_path, lang))
            languages_analyzed.add("python")
        elif (
            lang_lower in ("javascript", "typescript", "jsx", "tsx")
            or rel_path.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"))
        ):
            js_files.append((rel_path, lang))
            languages_analyzed.add(lang_lower if lang_lower in ("javascript", "typescript", "jsx", "tsx") else "javascript")
        else:
            languages_not_analyzed.add(lang_lower)

    # 1. Run Python resolver
    if py_files:
        py_resolver = PythonResolver()
        py_evidences, py_unparseable = py_resolver.resolve(
            files=files,  # pass full file index so it can check other files if needed
            read_file=read_file,
            clock=clock_fn,
            timeout_seconds=timeout_seconds,
        )
        evidences.extend(py_evidences)
        unparseable_files.extend(py_unparseable)

    # 2. Run JavaScript/TypeScript resolver
    if js_files:
        js_resolver = JavaScriptResolver()
        js_evidences, js_unparseable = js_resolver.resolve(
            files=files,
            read_file=read_file,
            clock=clock_fn,
            timeout_seconds=timeout_seconds,
        )
        evidences.extend(js_evidences)
        unparseable_files.extend(js_unparseable)

    wall_clock = clock_fn() - start_time
    _, peak_memory = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    peak_mb = round(peak_memory / (1024 * 1024), 2)

    # Compute coverage statistics
    internal_resolved = 0
    internal_unresolved = 0
    external_count = 0
    unresolved_specifiers: list[tuple[str, str]] = []

    for ev in evidences:
        if ev.kind == "internal":
            internal_resolved += 1
        elif ev.kind == "unresolved":
            internal_unresolved += 1
            unresolved_specifiers.append((ev.specifier, ev.source_file))
        elif ev.kind == "external":
            external_count += 1

    internal_total = internal_resolved + internal_unresolved
    ratio = (internal_resolved / internal_total) if internal_total > 0 else 1.0

    total_parsed = len(py_files) + len(js_files) - len(unparseable_files)
    if total_parsed < 0:
        total_parsed = 0

    coverage = ResolutionCoverage(
        files_parsed=total_parsed,
        internal_imports_total=internal_total,
        internal_resolved=internal_resolved,
        internal_unresolved=internal_unresolved,
        internal_resolution_ratio=round(ratio, 4),
        external_imports_count=external_count,
        unparseable_files=sorted(list(set(unparseable_files))),
        languages_analyzed=sorted(list(languages_analyzed)),
        languages_not_analyzed=sorted(list(languages_not_analyzed)),
        unresolved_specifiers=unresolved_specifiers,
        wall_clock_seconds=round(wall_clock, 3),
        peak_memory_mb=peak_mb,
    )

    return coverage, evidences

