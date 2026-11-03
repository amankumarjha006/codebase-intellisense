"""Unit tests for import analysis runner and coverage calculations."""

from pathlib import Path
from app.services.architecture.runner import analyze_repository_imports, infer_file_language


def test_infer_file_language():
    assert infer_file_language("main.py") == "python"
    assert infer_file_language("App.tsx") == "tsx"
    assert infer_file_language("index.ts") == "typescript"
    assert infer_file_language("Button.jsx") == "jsx"
    assert infer_file_language("util.js") == "javascript"
    assert infer_file_language("config.json") == "json"
    assert infer_file_language("notes.txt") == "other"


def test_analyze_repository_imports_pure():
    files_data = {
        "server/main.py": "import sys\nfrom server.utils import helper",
        "server/utils.py": "def helper(): pass",
        "client/App.tsx": 'import React from "react";\nimport { Card } from "./Card";',
        "client/Card.tsx": "export const Card = () => null;",
    }
    file_index = [
        ("server/main.py", "python"),
        ("server/utils.py", "python"),
        ("client/App.tsx", "tsx"),
        ("client/Card.tsx", "tsx"),
    ]
    reader = lambda p: files_data[p]

    coverage, evidences = analyze_repository_imports(
        files=file_index,
        read_file=reader,
    )

    assert coverage.files_parsed == 4
    assert coverage.internal_resolved == 2  # server.utils and ./Card
    assert coverage.internal_unresolved == 0
    assert coverage.internal_imports_total == 2
    assert coverage.internal_resolution_ratio == 1.0
    assert coverage.external_imports_count == 2  # sys and react
    assert coverage.unparseable_files == []
    assert "python" in coverage.languages_analyzed
    assert "tsx" in coverage.languages_analyzed
    assert coverage.wall_clock_seconds >= 0.0
    assert coverage.peak_memory_mb is not None


def test_analyze_repository_imports_monorepo_fixture():
    fixture_dir = Path("server/tests/fixtures/architecture/monorepo").resolve()
    assert fixture_dir.is_dir()

    coverage, evidences = analyze_repository_imports(repo_path=fixture_dir)

    assert coverage.files_parsed >= 2
    # packages/web imports @mono/core which resolves to packages/core/src/index.ts
    mono_ev = next(e for e in evidences if e.specifier == "@mono/core")
    assert mono_ev.kind == "internal"
    assert mono_ev.target_file == "packages/core/src/index.ts"
    assert coverage.internal_resolved >= 1

