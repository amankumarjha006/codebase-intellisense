import pytest
from pathlib import Path
from uuid import uuid4
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.indexing import (
    classify_file,
    discover_files_with_stats,
    LOCKFILE_NAMES,
    RepositoryTooLargeError,
    IndexingService,
)
from app.services.embedding.service import EmbeddingService
from app.services.embedding.provider import EmbeddingProvider
from app.models.repository import Repository, RepositoryVersion, IndexJob
from app.models.knowledge import File, CodeChunk
from app.schemas.repository import IndexJobOut


class CountingFakeEmbeddingProvider(EmbeddingProvider):
    """Fake embedding provider that tracks every invocation."""
    def __init__(self, dimension: int = 768):
        self.dimension = dimension
        self.call_count = 0
        self.calls = []

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.call_count += 1
        self.calls.append(texts)
        return [[0.1] * self.dimension for _ in texts]


# ---------------------------------------------------------------------------
# 1. Tests for File Filtering Rules (each category)
# ---------------------------------------------------------------------------

def test_filtering_lockfiles():
    """Verify all dependency manager lockfiles are skipped with reason 'lockfile'."""
    for lockfile in LOCKFILE_NAMES:
        keep, reason = classify_file(f"subdir/{lockfile}", file_size=1000)
        assert not keep, f"Expected {lockfile} to be skipped"
        assert reason == "lockfile", f"Expected 'lockfile' reason for {lockfile}, got {reason}"


def test_filtering_minified_and_generated():
    """Verify minified, map, generated code, and snapshot files are skipped."""
    cases = [
        ("static/js/app.min.js", "minified_or_generated"),
        ("static/css/theme.min.css", "minified_or_generated"),
        ("dist/bundle.js.map", "excluded_directory"),  # dist checked first
        ("src/bundle.js.map", "minified_or_generated"),
        ("proto/service.pb.go", "minified_or_generated"),
        ("models/user_pb2.py", "minified_or_generated"),
        ("models/schema.pb2.py", "minified_or_generated"),
        ("types/api.generated.ts", "minified_or_generated"),
        ("tests/component.test.js.snap", "minified_or_generated"),
    ]
    for rel_path, expected_reason in cases:
        keep, reason = classify_file(rel_path, file_size=500)
        assert not keep, f"Expected {rel_path} to be excluded"
        assert reason == expected_reason, f"Expected {expected_reason} for {rel_path}, got {reason}"


def test_filtering_excluded_directories():
    """Verify standard build/dependency/cache directories are skipped."""
    dirs = [
        "node_modules/pkg/index.js",
        "dist/bundle.js",
        "build/static/app.js",
        ".next/server/pages.js",
        "target/debug/app.rs",
        "vendor/bundle/gem.rb",
        ".venv/lib/site.py",
        "venv/lib/site.py",
        "__pycache__/app.cpython-311.pyc",
        ".git/objects/abc",
        "coverage/lcov.info",
        "tests/__snapshots__/render.json",
    ]
    for path in dirs:
        keep, reason = classify_file(path, file_size=500)
        assert not keep, f"Expected {path} to be excluded"
        assert reason == "excluded_directory", f"Expected excluded_directory for {path}, got {reason}"


def test_filtering_binary_and_assets():
    """Verify non-code assets, media, fonts, archives, and compiled binaries are skipped."""
    assets = [
        ("assets/logo.png", "binary_or_asset"),
        ("images/photo.jpeg", "binary_or_asset"),
        ("icons/favicon.ico", "binary_or_asset"),
        ("assets/illustration.svg", "binary_or_asset"),
        ("fonts/inter.woff2", "binary_or_asset"),
        ("fonts/roboto.ttf", "binary_or_asset"),
        ("downloads/archive.zip", "binary_or_asset"),
        ("downloads/tarball.tar.gz", "binary_or_asset"),
        ("docs/manual.pdf", "binary_or_asset"),
        ("audio/track.mp3", "binary_or_asset"),
        ("video/demo.mp4", "binary_or_asset"),
        ("bin/program.exe", "excluded_directory"),  # bin checked first
        ("lib/library.so", "binary_or_asset"),
        ("lib/library.dll", "binary_or_asset"),
        ("classes/App.class", "binary_or_asset"),
    ]
    for rel_path, expected_reason in assets:
        keep, reason = classify_file(rel_path, file_size=500)
        assert not keep, f"Expected {rel_path} to be excluded"
        assert reason == expected_reason, f"Expected {expected_reason} for {rel_path}, got {reason}"


def test_filtering_large_data_files():
    """Verify data files exceeding INDEXING_DATA_FILE_MAX_BYTES (50KB) are skipped."""
    max_data_bytes = 50000
    data_files = ["data/records.csv", "data/dump.json", "data/stream.ndjson", "data/table.parquet"]

    for path in data_files:
        # Under threshold: kept (if language is recognized, e.g. json/csv)
        keep, reason = classify_file(path, file_size=40000, max_data_file_size=max_data_bytes)
        if path.endswith(".json"):
            assert keep, f"Expected small json {path} to be indexed"
            assert reason is None

        # Over threshold: skipped with large_data_file
        keep_large, reason_large = classify_file(path, file_size=60000, max_data_file_size=max_data_bytes)
        assert not keep_large, f"Expected large data file {path} to be skipped"
        assert reason_large == "large_data_file"


def test_filtering_single_file_too_large():
    """Verify any single file exceeding MAX_INDEXABLE_FILE_SIZE_BYTES (200KB) is skipped."""
    max_file_bytes = 200000

    # 199 KB file: kept
    keep, reason = classify_file("src/main.py", file_size=199000, max_file_size=max_file_bytes)
    assert keep
    assert reason is None

    # 201 KB file: skipped
    keep_large, reason_large = classify_file("src/main.py", file_size=201000, max_file_size=max_file_bytes)
    assert not keep_large
    assert reason_large == "file_too_large"


def test_filtering_hidden_and_unsupported_files():
    """Verify hidden files (dotfiles) and unsupported extensions are skipped."""
    # Hidden files
    keep, reason = classify_file(".env.secret", file_size=100)
    assert not keep
    assert reason == "hidden_file"

    keep_gi, reason_gi = classify_file(".gitignore", file_size=100)
    assert not keep_gi
    assert reason_gi == "hidden_file"

    # Unsupported extension
    keep_xyz, reason_xyz = classify_file("docs/notes.xyz123", file_size=100)
    assert not keep_xyz
    assert reason_xyz == "unsupported_language"


def test_discover_files_with_stats_skip_counters(tmp_path):
    """Verify discover_files_with_stats correctly accumulates counts per skip reason."""
    repo = tmp_path / "test_repo"
    repo.mkdir()

    # Valid files
    (repo / "main.py").write_text("print('hello')", encoding="utf-8")
    (repo / "util.ts").write_text("export const x = 1;", encoding="utf-8")

    # Lockfiles
    (repo / "package-lock.json").write_text("{}", encoding="utf-8")
    (repo / "yarn.lock").write_text("", encoding="utf-8")

    # Minified
    (repo / "bundle.min.js").write_text("var a=1;", encoding="utf-8")

    # Excluded directory
    nm = repo / "node_modules"
    nm.mkdir()
    (nm / "dep.js").write_text("module.exports = {};", encoding="utf-8")

    # Binary asset
    (repo / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n")

    # Large data file (> 50KB)
    (repo / "large.json").write_text("{\"data\": " + "\"x\"" * 60000 + "}", encoding="utf-8")

    # Oversized file (> 200KB)
    (repo / "huge.py").write_text("# code\n" + "x = 1\n" * 40000, encoding="utf-8")

    files, skip_counts = discover_files_with_stats(
        str(repo),
        max_file_size=200000,
        max_data_file_size=50000,
    )

    rel_paths = [f[0] for f in files]
    assert "main.py" in rel_paths
    assert "util.ts" in rel_paths
    assert len(files) == 2

    assert skip_counts.get("lockfile") == 2
    assert skip_counts.get("minified_or_generated") == 1
    assert skip_counts.get("excluded_directory") == 1
    assert skip_counts.get("binary_or_asset") == 1
    assert skip_counts.get("large_data_file") == 1
    assert skip_counts.get("file_too_large") == 1


# ---------------------------------------------------------------------------
# 2. Token Estimator Tests
# ---------------------------------------------------------------------------

def test_token_estimator_with_chars_per_token():
    """Verify token estimation respects chars_per_token setting."""
    text = "a" * 300
    # Default is 3 chars per token -> 100 tokens
    assert EmbeddingService.estimate_tokens(text, chars_per_token=3) == 100
    # Conservative 4 chars per token -> 75 tokens
    assert EmbeddingService.estimate_tokens(text, chars_per_token=4) == 75
    # Aggressive 2 chars per token -> 150 tokens
    assert EmbeddingService.estimate_tokens(text, chars_per_token=2) == 150
    # Minimum 1 token for short non-empty text
    assert EmbeddingService.estimate_tokens("hi", chars_per_token=3) == 1


# ---------------------------------------------------------------------------
# 3. Token Cap Failure Fast (Zero Calls to Embedding Provider)
# ---------------------------------------------------------------------------

def test_repository_token_cap_fails_before_any_embedding_call(monkeypatch):
    """
    Verify that when total estimated tokens exceed INDEXING_MAX_ESTIMATED_TOKENS,
    run_indexing fails fast with failure_code REPOSITORY_TOO_LARGE, sets the safe
    fixed message, and makes ZERO calls to the embedding provider.
    """
    mock_db = MagicMock()
    fake_provider = CountingFakeEmbeddingProvider()
    mock_knowledge_repo = MagicMock()
    embedding_service = EmbeddingService(mock_knowledge_repo, fake_provider)

    service = IndexingService(mock_db, embedding_service=embedding_service)

    repo_id = uuid4()
    version_id = uuid4()
    job_id = uuid4()

    mock_repo = Repository(id=repo_id, owner="owner", name="repo", clone_url="https://github.com/owner/repo.git")
    mock_version = RepositoryVersion(id=version_id, repository_id=repo_id, commit_sha="abc1234", branch="main")
    mock_job = IndexJob(id=job_id, repository_id=repo_id, repository_version_id=version_id, status="QUEUED")

    service.repository_repo.get_by_id = MagicMock(return_value=mock_repo)
    service.repository_repo.get_version_by_id = MagicMock(return_value=mock_version)
    service.repository_repo.get_job_by_id = MagicMock(return_value=mock_job)

    # Mock fetch and cleanup
    service._fetch_repository = MagicMock(return_value="/tmp/mock_repo")
    service._cleanup_repo = MagicMock()

    # Set token cap to 100 tokens for this test
    monkeypatch.setattr(settings, "INDEXING_MAX_ESTIMATED_TOKENS", 100)
    monkeypatch.setattr(settings, "EMBEDDING_CHARS_PER_TOKEN", 3)

    # Mock discover_files_with_stats returning 1 file
    monkeypatch.setattr(
        "app.services.indexing.discover_files_with_stats",
        lambda path: ([("big_code.py", "/tmp/mock_repo/big_code.py")], {})
    )

    # Mock db.execute to return File and CodeChunk records
    mock_file = File(id=uuid4(), repository_version_id=version_id, file_path="big_code.py", language="python")
    # Chunk with 900 characters = 300 estimated tokens (cap is 100)
    huge_chunk = CodeChunk(id=uuid4(), file_id=mock_file.id, file=mock_file, content="x" * 900, start_line=1, end_line=50)

    def fake_execute(stmt):
        mock_result = MagicMock()
        sql_str = str(stmt).lower()
        if "code_chunks" in sql_str:
            mock_result.scalars.return_value.unique.return_value.all.return_value = [huge_chunk]
            mock_result.scalars.return_value.all.return_value = [huge_chunk]
        elif "files" in sql_str:
            mock_result.scalars.return_value.all.return_value = [mock_file]
        return mock_result

    mock_db.execute = fake_execute

    with patch("app.services.symbol_extractor.SymbolExtractorService.extract_symbols", return_value={"symbols_extracted": 0, "files_processed": 1, "files_skipped": 0}), \
         patch("app.services.chunking.ChunkBuilderService.build_chunks", return_value={"chunks_created": 1, "files_processed": 1}), \
         patch("app.services.indexing.read_file_content", return_value=("x" * 900, "dummy_hash")), \
         patch("app.repositories.knowledge.KnowledgeRepository.delete_files_for_version", return_value=0), \
         patch("app.repositories.knowledge.KnowledgeRepository.delete_analysis_results_for_version", return_value=None):

        with pytest.raises(RepositoryTooLargeError):
            service.run_indexing(mock_job)

    # CRITICAL ASSERTION: Zero calls made to embedding provider
    assert fake_provider.call_count == 0, f"Expected 0 embedding calls, but got {fake_provider.call_count}"
    assert fake_provider.calls == []

    # Job failure assertions: correct code and fixed safe message
    assert mock_job.status == "FAILED"
    assert mock_job.failure_code == "REPOSITORY_TOO_LARGE"
    assert mock_job.error_message == "The repository is too large to be indexed."
    # Never expose raw exception details in error_message
    assert "900" not in mock_job.error_message
    assert "exceeds" not in mock_job.error_message


# ---------------------------------------------------------------------------
# 4. Error Message Sanitization (Never Expose Raw Error Text)
# ---------------------------------------------------------------------------

def test_index_job_out_sanitizes_repository_too_large():
    """Verify IndexJobOut sanitizes failure_code REPOSITORY_TOO_LARGE into fixed user-safe message."""
    raw_job = {
        "id": uuid4(),
        "repository_id": uuid4(),
        "repository_version_id": uuid4(),
        "status": "FAILED",
        "failure_code": "REPOSITORY_TOO_LARGE",
        "failure_message": None,
    }
    out = IndexJobOut.model_validate(raw_job)

    assert out.failure_code == "REPOSITORY_TOO_LARGE"
    assert out.failure_message == "The repository is too large to be indexed."
