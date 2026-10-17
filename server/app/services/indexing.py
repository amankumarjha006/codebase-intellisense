import logging
import os
import hashlib
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional, Set, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge import (
    File,
    Symbol,
)
from app.models.repository import IndexJob, Repository, RepositoryVersion
from app.repositories.knowledge import KnowledgeRepository
from app.repositories.repository import RepositoryRepository

logger = logging.getLogger(__name__)

DEFAULT_EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    "coverage",
    "__pycache__",
    "vendor",
    ".venv",
    "venv",
    "env",
    ".idea",
    ".vscode",
    "target",
    "out",
    "bin",
    "obj",
    "__snapshots__",
}

LOCKFILE_NAMES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "cargo.lock",
    "go.sum",
    "composer.lock",
    "gemfile.lock",
}

BINARY_AND_ASSET_EXTENSIONS = {
    # Images & graphics
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".bmp", ".tiff", ".psd", ".ai",
    # Fonts
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    # Archives & compressed
    ".zip", ".tar", ".gz", ".tgz", ".7z", ".rar", ".bz2", ".xz",
    # Documents & media
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".flv", ".ogg", ".webm", ".mkv",
    # Compiled binaries & bytecode
    ".exe", ".dll", ".so", ".dylib", ".bin", ".dat", ".db", ".sqlite", ".sqlite3",
    ".class", ".jar", ".war", ".ear", ".pyc", ".pyo", ".pyd", ".o", ".a", ".lib",
    ".iso", ".dmg",
    # Cache & logs & temp
    ".cache", ".log", ".tmp", ".temp", ".swp", ".swo",
}

DATA_FILE_EXTENSIONS = {".csv", ".tsv", ".json", ".ndjson", ".jsonl", ".parquet"}

DEFAULT_EXCLUDE_EXTENSIONS = BINARY_AND_ASSET_EXTENSIONS | {".min.js", ".map", ".lock"}

LANGUAGE_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".java": "java",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "c_sharp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".clj": "clojure",
    ".hs": "haskell",
    ".ml": "ocaml",
    ".fs": "fsharp",
    ".lua": "lua",
    ".pl": "perl",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".fish": "bash",
    ".sql": "sql",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "scss",
    ".less": "less",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".md": "markdown",
    ".rst": "rst",
    ".txt": "text",
    ".dockerfile": "dockerfile",
    ".proto": "protobuf",
    ".vue": "vue",
    ".svelte": "svelte",
}


class IndexingError(Exception):
    """Base exception for indexing operations."""
    pass


class GitError(IndexingError):
    """Raised when Git operations fail."""
    pass


class ParseError(IndexingError):
    """Raised when code parsing fails."""
    pass


class EmbeddingError(IndexingError):
    """Raised when embedding generation fails."""
    pass


class RepositoryTooLargeError(IndexingError):
    """Raised when repository exceeds the maximum token cap for embedding."""
    pass


def get_language_for_file(file_path: str) -> Optional[str]:
    """Determine the programming language from file extension."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    return LANGUAGE_EXTENSIONS.get(suffix)


def classify_file(
    rel_path: str,
    file_size: int = 0,
    max_file_size: Optional[int] = None,
    max_data_file_size: Optional[int] = None,
    exclude_dirs: Optional[Set[str]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Classify a file for indexing. Returns (should_index, skip_reason).
    Skip reasons:
      - 'excluded_directory': directory is in excluded directories list
      - 'lockfile': file is a dependency manager lockfile
      - 'minified_or_generated': minified, sourcemap, generated code, or snapshot
      - 'binary_or_asset': media, font, image, archive, or compiled binary
      - 'large_data_file': csv, json, ndjson, parquet exceeding size threshold
      - 'file_too_large': any single file exceeding MAX_INDEXABLE_FILE_SIZE_BYTES
      - 'hidden_file': hidden file starting with '.'
      - 'unsupported_language': extension not supported
    """
    path = Path(rel_path)
    parts = set(path.parts)
    effective_exclude_dirs = exclude_dirs if exclude_dirs is not None else DEFAULT_EXCLUDE_DIRS

    # 1. Directory exclusion
    if parts & effective_exclude_dirs or "__snapshots__" in parts:
        return False, "excluded_directory"

    file_name = path.name
    file_name_lower = file_name.lower()
    rel_path_lower = rel_path.lower()
    suffix = path.suffix.lower()

    # 2. Lockfiles
    if file_name_lower in LOCKFILE_NAMES:
        return False, "lockfile"

    # 3. Minified / Source maps / Generated code / Snapshots
    if (
        rel_path_lower.endswith(".min.js")
        or rel_path_lower.endswith(".min.css")
        or rel_path_lower.endswith(".map")
        or rel_path_lower.endswith(".pb.go")
        or file_name_lower.endswith("_pb2.py")
        or file_name_lower.endswith(".pb2.py")
        or ".generated." in file_name_lower
        or file_name_lower.endswith(".snap")
    ):
        return False, "minified_or_generated"

    # 4. Binary and non-code assets
    if suffix in BINARY_AND_ASSET_EXTENSIONS:
        return False, "binary_or_asset"

    # 5. Single file max size check
    effective_max_file_size = (
        max_file_size
        if max_file_size is not None
        else getattr(settings, "MAX_INDEXABLE_FILE_SIZE_BYTES", 200000)
    )
    if file_size > effective_max_file_size:
        return False, "file_too_large"

    # 6. Large data files
    effective_max_data_size = (
        max_data_file_size
        if max_data_file_size is not None
        else getattr(settings, "INDEXING_DATA_FILE_MAX_BYTES", 50000)
    )
    if suffix in DATA_FILE_EXTENSIONS and file_size > effective_max_data_size:
        return False, "large_data_file"

    # 7. Hidden files
    if file_name.startswith("."):
        return False, "hidden_file"

    # 8. Unsupported language
    language = get_language_for_file(rel_path)
    if language is None:
        return False, "unsupported_language"

    return True, None


def should_exclude_file(file_path: str, exclude_dirs: Optional[Set[str]] = None) -> bool:
    """Check if a file should be excluded from indexing (backwards compatibility)."""
    should_index, _ = classify_file(file_path, file_size=0, exclude_dirs=exclude_dirs)
    return not should_index


def compute_file_hash(content: bytes) -> str:
    """Compute SHA256 hash of file content."""
    return hashlib.sha256(content).hexdigest()[:128]


def clone_repository(clone_url: str, target_dir: str, branch: str = "main", github_token: Optional[str] = None) -> str:
    """Clone a repository and return the commit SHA."""
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    
    if github_token:
        # Pass authentication header via in-memory git configuration environment variables
        # rather than creating temporary config files on disk or exposing secrets in argv.
        header_val = f"Authorization: Bearer {github_token}"
        env["GIT_CONFIG_COUNT"] = "1"
        env["GIT_CONFIG_KEY_0"] = "http.extraHeader"
        env["GIT_CONFIG_VALUE_0"] = header_val
        env["GIT_CONFIG_PARAMETERS"] = f"'http.extraHeader={header_val}'"

    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", branch, clone_url, target_dir],
            capture_output=True,
            text=True,
            timeout=300,
            env=env
        )
        if result.returncode != 0:
            err = result.stderr
            if github_token:
                err = err.replace(github_token, "***")
            raise GitError(f"Failed to clone repository: {err}")

        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            timeout=30,
            env=env
        )
        if commit_result.returncode != 0:
            err = commit_result.stderr
            if github_token:
                err = err.replace(github_token, "***")
            raise GitError(f"Failed to get commit SHA: {err}")

        return commit_result.stdout.strip()
    except subprocess.TimeoutExpired:
        raise GitError("Git operation timed out")
    except FileNotFoundError:
        raise GitError("Git not found in PATH")


def discover_files_with_stats(
    root_dir: str,
    max_file_size: Optional[int] = None,
    max_data_file_size: Optional[int] = None,
    exclude_dirs: Optional[Set[str]] = None,
) -> Tuple[List[Tuple[str, str]], dict[str, int]]:
    """Discover all files in the repository that should be indexed, with skip counters.
    Returns (files, skip_counts) where files is a list of (relative_path, absolute_path).
    """
    from collections import defaultdict
    files = []
    skip_counts: dict[str, int] = defaultdict(int)
    root = Path(root_dir).resolve()

    for file_path in root.rglob("*"):
        # Skip any symlink (file or directory) to prevent escape
        if file_path.is_symlink():
            skip_counts["symlink"] += 1
            continue

        if not file_path.is_file():
            continue

        # Resolve the real path and ensure it is inside the root
        try:
            resolved = file_path.resolve()
            resolved.relative_to(root)
        except (ValueError, OSError):
            skip_counts["path_traversal"] += 1
            continue

        try:
            rel_path = file_path.relative_to(root).as_posix()
        except ValueError:
            continue

        try:
            file_size = file_path.stat().st_size
        except OSError:
            file_size = 0

        should_index, reason = classify_file(
            rel_path,
            file_size=file_size,
            max_file_size=max_file_size,
            max_data_file_size=max_data_file_size,
            exclude_dirs=exclude_dirs,
        )

        if not should_index:
            if reason:
                skip_counts[reason] += 1
            continue

        files.append((rel_path, str(resolved)))

    return files, dict(skip_counts)


def discover_files(root_dir: str) -> List[Tuple[str, str]]:
    """Discover all files in the repository that should be indexed.
    Returns list of (relative_path, absolute_path) tuples.

    Security: symlinks are skipped entirely and resolved paths are verified
    to remain inside the repository root to prevent path traversal attacks.
    """
    files, _ = discover_files_with_stats(root_dir)
    return files


def read_file_content(file_path: str) -> Tuple[str, str]:
    """Read file content and return (content, hash)."""
    with open(file_path, "rb") as f:
        content_bytes = f.read()

    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = content_bytes.decode("utf-8", errors="replace")

    file_hash = compute_file_hash(content_bytes)
    return content, file_hash


def _detect_technologies(repo_path: str) -> dict:
    """Detect technologies from repository evidence."""
    import json
    
    technologies = {
        "frameworks": [],
        "libraries": [],
        "tools": []
    }
    
    if not repo_path:
        return technologies
        
    repo = Path(repo_path)
    
    # JS/TS
    pkg_json = repo / "package.json"
    if pkg_json.is_file():
        try:
            with open(pkg_json, 'r', encoding='utf-8') as f:
                data = json.load(f)
                deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
                
                if "react" in deps:
                    technologies["frameworks"].append({"name": "React", "evidence": "package.json"})
                if "next" in deps:
                    technologies["frameworks"].append({"name": "Next.js", "evidence": "package.json"})
                if "express" in deps:
                    technologies["frameworks"].append({"name": "Express", "evidence": "package.json"})
                if "vue" in deps:
                    technologies["frameworks"].append({"name": "Vue", "evidence": "package.json"})
                if "typescript" in deps:
                    technologies["tools"].append({"name": "TypeScript", "evidence": "package.json"})
        except Exception:
            pass

    # Python
    req_txt = repo / "requirements.txt"
    if req_txt.is_file():
        try:
            with open(req_txt, 'r', encoding='utf-8') as f:
                content = f.read().lower()
                if "fastapi" in content:
                    technologies["frameworks"].append({"name": "FastAPI", "evidence": "requirements.txt"})
                if "django" in content:
                    technologies["frameworks"].append({"name": "Django", "evidence": "requirements.txt"})
                if "flask" in content:
                    technologies["frameworks"].append({"name": "Flask", "evidence": "requirements.txt"})
                if "sqlalchemy" in content:
                    technologies["libraries"].append({"name": "SQLAlchemy", "evidence": "requirements.txt"})
        except Exception:
            pass

    # Docker
    if (repo / "Dockerfile").is_file():
        technologies["tools"].append({"name": "Docker", "evidence": "Dockerfile"})
    if (repo / "docker-compose.yml").is_file() or (repo / "docker-compose.yaml").is_file():
        technologies["tools"].append({"name": "Docker Compose", "evidence": "docker-compose.yml"})

    # Sort deterministically
    technologies["frameworks"].sort(key=lambda x: x["name"])
    technologies["libraries"].sort(key=lambda x: x["name"])
    technologies["tools"].sort(key=lambda x: x["name"])
    
    return technologies




class IndexingService:
    """Main service for repository indexing pipeline."""

    def __init__(self, db: Session, embedding_service=None):
        self.db = db
        self.repository_repo = RepositoryRepository(db)
        self.embedding_service = embedding_service

    def run_indexing(self, job: IndexJob) -> None:
        """Run the full indexing pipeline for a job."""
        repository = self.repository_repo.get_by_id(job.repository_id)
        if not repository:
            raise IndexingError(f"Repository {job.repository_id} not found")

        version = self.repository_repo.get_version_by_id(job.repository_version_id)
        if not version:
            raise IndexingError(f"Repository version {job.repository_version_id} not found")

        repo_path = None
        try:
            self._update_job_status(job.id, "FETCHING")
            self.db.commit()

            repo_path = self._fetch_repository(repository, version)

            self._update_job_status(job.id, "INDEXING")
            self.db.commit()

            self._index_repository(repo_path, version)

            # Indexing data is now committed. Mark version as SUCCESS.
            version.index_status = "SUCCESS"
            from datetime import datetime, timezone
            version.indexed_at = datetime.now(timezone.utc)
            self.db.commit()

            # Analysis is a post-index operation. Its failure does NOT
            # invalidate already-committed indexed data.
            try:
                self._update_job_status(job.id, "ANALYZING")
                self.db.commit()

                self._analyze_repository(version, repo_path)
            except Exception as analysis_err:
                logger.error(f"Analysis failed for job {job.id}: {analysis_err}")
                self.db.rollback()
                # Analysis failure does not overwrite SUCCESS on the version.
                # The job records the error but the indexed data remains valid.

            self._update_job_status(job.id, "READY")
            self.db.commit()

        except Exception as e:
            logger.error(f"Indexing failed for job {job.id}: {e}")
            self.db.rollback()

            failure_code = "INTERNAL_ERROR"
            error_message = str(e)
            if isinstance(e, GitError):
                failure_code = "CLONE_FAILED"
            elif isinstance(e, RepositoryTooLargeError):
                failure_code = "REPOSITORY_TOO_LARGE"
                error_message = "The repository is too large to be indexed."
            else:
                from app.services.embedding.exceptions import (
                    EmbeddingProviderAuthError,
                    EmbeddingProviderConnectionError,
                    EmbeddingProviderError,
                    EmbeddingProviderRateLimitError,
                    EmbeddingProviderServerError,
                    EmbeddingProviderTimeoutError,
                )

                provider_error = e.__cause__ if isinstance(e, EmbeddingError) and e.__cause__ else e
                if isinstance(provider_error, EmbeddingProviderRateLimitError):
                    failure_code = "EMBEDDING_PROVIDER_RATE_LIMITED"
                elif isinstance(provider_error, EmbeddingProviderAuthError):
                    failure_code = "EMBEDDING_PROVIDER_AUTH"
                elif isinstance(
                    provider_error,
                    (
                        EmbeddingProviderConnectionError,
                        EmbeddingProviderTimeoutError,
                        EmbeddingProviderServerError,
                    ),
                ):
                    failure_code = "EMBEDDING_PROVIDER_UNAVAILABLE"
                elif isinstance(provider_error, EmbeddingProviderError):
                    failure_code = "INTERNAL_ERROR"

            if failure_code == "REPOSITORY_TOO_LARGE":
                error_message = "The repository is too large to be indexed."

            self._update_job_status(job.id, "FAILED", error_message, failure_code)
            version.index_status = "FAILED"
            self.db.commit()
            raise
        finally:
            self._cleanup_repo(repo_path)

    def _fetch_repository(self, repository: Repository, version: RepositoryVersion) -> str:
        """Clone the repository to a temporary directory."""
        temp_dir = tempfile.mkdtemp(prefix=f"index_{repository.id}_")
        
        github_token = None
        if repository.github_installation_id:
            from app.models.user import GithubInstallation, GithubAccount
            from sqlalchemy.orm import joinedload
            from sqlalchemy import select
            
            stmt = (
                select(GithubAccount)
                .join(GithubInstallation)
                .where(GithubInstallation.id == repository.github_installation_id)
            )
            account = self.db.execute(stmt).scalar_one_or_none()
            if account and account.access_token_encrypted:
                from app.services.github_token import get_decrypted_token
                github_token = get_decrypted_token(account)
                
        try:
            clone_repository(repository.clone_url, temp_dir, version.branch, github_token=github_token)
            return temp_dir
        except Exception as e:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise

    def _cleanup_repo(self, repo_path: Optional[str]) -> None:
        """Clean up the temporary repository directory."""
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)

    def _update_job_status(self, job_id: UUID, status: str, error_message: Optional[str] = None, failure_code: Optional[str] = None) -> None:
        """Update the index job status."""
        from datetime import datetime, timezone

        job = self.repository_repo.get_job_by_id(job_id)
        if job:
            job.status = status
            job.error_message = error_message
            if failure_code is not None:
                job.failure_code = failure_code
            if status in ("FETCHING", "INDEXING", "ANALYZING") and not job.started_at:
                job.started_at = datetime.now(timezone.utc)
            if status in ("READY", "FAILED"):
                job.completed_at = datetime.now(timezone.utc)
            self.db.commit()

    def _index_repository(self, repo_path: str, version: RepositoryVersion) -> None:
        """Index all files in the repository, then run symbol extraction."""
        from sqlalchemy import select as sa_select
        from app.services.symbol_extractor import SymbolExtractorService

        knowledge_repo = KnowledgeRepository(self.db)

        # --- Re-index cleanup: remove existing data for this version ---
        deleted_count = knowledge_repo.delete_files_for_version(version.id)
        if isinstance(deleted_count, int) and deleted_count > 0:
            logger.info(f"Re-index: removed {deleted_count} existing files for version {version.id}")
        knowledge_repo.delete_analysis_results_for_version(version.id)
        discovery_result = discover_files_with_stats(repo_path)
        if isinstance(discovery_result, tuple) and len(discovery_result) == 2 and isinstance(discovery_result[1], dict):
            files, skip_counts = discovery_result
        else:
            files, skip_counts = discovery_result, {}
        total_discovered = len(files) + sum(skip_counts.values())
        logger.info(
            f"File discovery complete for version {version.id}: "
            f"discovered={total_discovered}, to_index={len(files)}, "
            f"skipped_by_reason={skip_counts}"
        )

        file_records = [
            self._prepare_file_record(rel_path, abs_path, version)
            for rel_path, abs_path in files
        ]
        if file_records:
            knowledge_repo.bulk_create_files(file_records)

        # --- Symbol extraction ---
        stmt = sa_select(File).where(File.repository_version_id == version.id)
        indexed_files = list(self.db.execute(stmt).scalars().all())
        if indexed_files:
            symbol_service = SymbolExtractorService(knowledge_repo, repo_path)
            stats = symbol_service.extract_symbols(version, indexed_files)
            logger.info(
                f"Symbol extraction complete for version {version.id}: "
                f"{stats['symbols_extracted']} symbols from "
                f"{stats['files_processed']} files "
                f"({stats['files_skipped']} skipped)"
            )
            
        # --- Chunk Building ---
        new_chunks = []
        if indexed_files:
            from app.services.chunking import ChunkBuilderService
            chunk_service = ChunkBuilderService(knowledge_repo, repo_path)
            chunk_stats = chunk_service.build_chunks(version, indexed_files)
            logger.info(
                f"Chunk building complete for version {version.id}: "
                f"{chunk_stats['chunks_created']} chunks created from "
                f"{chunk_stats['files_processed']} files"
            )

            from app.models.knowledge import CodeChunk
            from sqlalchemy.orm import joinedload
            
            stmt = (
                sa_select(CodeChunk)
                .join(File, CodeChunk.file_id == File.id)
                .where(File.repository_version_id == version.id)
            )
            stmt = stmt.options(joinedload(CodeChunk.file), joinedload(CodeChunk.symbol))
            new_chunks = list(self.db.execute(stmt).scalars().unique().all())

        # --- Token Estimation, Per-Job Log, and Cap Enforcement ---
        if indexed_files:
            from app.services.embedding.text_builder import ChunkEmbeddingTextBuilder
            from app.services.embedding.service import EmbeddingService

            chars_per_token = getattr(settings, "EMBEDDING_CHARS_PER_TOKEN", 3)
            total_estimated_tokens = sum(
                EmbeddingService.estimate_tokens(ChunkEmbeddingTextBuilder.build(c), chars_per_token)
                for c in new_chunks
            )

            batch_tokens = settings.EMBEDDING_MAX_BATCH_TOKENS
            batch_items = settings.EMBEDDING_MAX_BATCH_ITEMS
            batch_interval = settings.EMBEDDING_MIN_INTERVAL_SECONDS
            estimated_batches = max(1, (total_estimated_tokens + batch_tokens - 1) // batch_tokens) if new_chunks else 0
            estimated_minutes = round((estimated_batches * (batch_interval + 1.0)) / 60.0, 1)

            # Per-job INFO log (no file contents, no keys)
            logger.info(
                f"[Indexing Job Metrics] version_id={version.id} | "
                f"files_discovered={total_discovered} | "
                f"files_skipped_by_reason={skip_counts} | "
                f"files_indexed={len(indexed_files)} | "
                f"chunks={len(new_chunks)} | "
                f"estimated_tokens={total_estimated_tokens} | "
                f"batch_tokens={batch_tokens} | "
                f"batch_items={batch_items} | "
                f"batch_interval_seconds={batch_interval} | "
                f"estimated_minutes_to_embed={estimated_minutes}"
            )

            # Check per-repository token cap BEFORE calling embedding provider
            max_token_cap = getattr(settings, "INDEXING_MAX_ESTIMATED_TOKENS", 1000000)
            if total_estimated_tokens > max_token_cap:
                logger.error(
                    f"Repository exceeds token cap: {total_estimated_tokens} > {max_token_cap} tokens. "
                    f"Failing job before embedding calls."
                )
                raise RepositoryTooLargeError(
                    f"Repository exceeds the maximum token limit for analysis ({total_estimated_tokens} > {max_token_cap})"
                )

        # --- Embedding Generation ---
        if indexed_files and self.embedding_service and new_chunks:
            try:
                embedding_stats = self.embedding_service.generate_and_store_embeddings(new_chunks)
                logger.info(
                    f"Embedding generation complete for version {version.id}: "
                    f"{embedding_stats['embeddings_created']} embeddings created."
                )
            except Exception as e:
                logger.error(f"Embedding generation failed: {str(e)}")
                raise EmbeddingError(f"Embedding generation failed: {str(e)}") from e

        self.db.commit()

    def _prepare_file_record(
        self, rel_path: str, abs_path: str, version: RepositoryVersion
    ) -> File:
        """Create a File model instance without flushing to the database."""
        content, file_hash = read_file_content(abs_path)
        language = get_language_for_file(rel_path) or "text"

        return File(
            repository_version_id=version.id,
            file_path=rel_path,
            file_name=Path(rel_path).name,
            language=language,
            size_bytes=len(content.encode("utf-8")),
            hash=file_hash,
        )

    def _index_file(
        self, repo_root: str, rel_path: str, abs_path: str, version: RepositoryVersion
    ) -> File:
        """Index a single file."""
        file_record = self._prepare_file_record(rel_path, abs_path, version)
        self.db.add(file_record)
        self.db.flush()
        return file_record

    def _analyze_repository(self, version: RepositoryVersion, repo_path: str = None) -> None:
        """Run repository-level analysis (tech stack, architecture, statistics)."""
        from app.models.knowledge import AnalysisResult
        from app.repositories.knowledge import KnowledgeRepository

        knowledge_repo = KnowledgeRepository(self.db)

        file_count = knowledge_repo.count_files_for_version(version.id)
        symbol_count = knowledge_repo.count_symbols_for_version(version.id)
        chunk_count = knowledge_repo.count_chunks_for_version(version.id)
        languages = knowledge_repo.get_language_stats_for_version(version.id)

        tech_stack = {
            "languages": [{"language": lang, "file_count": count} for lang, count in languages],
            "total_files": file_count,
            "total_symbols": symbol_count,
            "total_chunks": chunk_count,
        }

        analysis = AnalysisResult(
            repository_version_id=version.id,
            analysis_type="STATISTICS",
            payload=tech_stack,
        )
        self.db.add(analysis)

        detected = _detect_technologies(repo_path) if repo_path else {}
        tech_payload = {
            "languages": [lang for lang, _ in languages],
            "frameworks": detected.get("frameworks", []),
            "libraries": detected.get("libraries", []),
            "tools": detected.get("tools", [])
        }

        tech_analysis = AnalysisResult(
            repository_version_id=version.id,
            analysis_type="TECH_STACK",
            payload=tech_payload,
        )
        self.db.add(tech_analysis)

        overview = AnalysisResult(
            repository_version_id=version.id,
            analysis_type="OVERVIEW",
            payload={
                "total_files": file_count,
                "total_symbols": symbol_count,
                "total_chunks": chunk_count,
                "languages": [{"language": lang, "file_count": count} for lang, count in languages],
                "repository_id": str(version.repository_id),
                "branch": version.branch,
                "commit_sha": version.commit_sha,
            },
        )
        self.db.add(overview)

        # Generate relationships and architecture
        knowledge_repo.generate_file_relationships(version.id)
        arch_data = knowledge_repo.get_architecture_data(version.id)

        architecture = AnalysisResult(
            repository_version_id=version.id,
            analysis_type="ARCHITECTURE",
            payload=arch_data,
        )
        self.db.add(architecture)

        self.db.commit()