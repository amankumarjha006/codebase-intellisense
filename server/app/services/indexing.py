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
from app.repositories.repository import RepositoryRepository

logger = logging.getLogger(__name__)

DEFAULT_EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
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
}

DEFAULT_EXCLUDE_EXTENSIONS = {
    ".min.js",
    ".map",
    ".lock",
    ".log",
    ".tmp",
    ".temp",
    ".cache",
    ".class",
    ".jar",
    ".war",
    ".ear",
    ".dll",
    ".so",
    ".dylib",
    ".exe",
    ".bin",
    ".dat",
    ".db",
    ".sqlite",
    ".sqlite3",
    ".pyc",
    ".pyo",
    ".pyd",
}

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

CHUNK_MAX_LINES = 100
CHUNK_OVERLAP_LINES = 10


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


def get_language_for_file(file_path: str) -> Optional[str]:
    """Determine the programming language from file extension."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    return LANGUAGE_EXTENSIONS.get(suffix)


def should_exclude_file(file_path: str, exclude_dirs: Optional[Set[str]] = None) -> bool:
    """Check if a file should be excluded from indexing."""
    if exclude_dirs is None:
        exclude_dirs = DEFAULT_EXCLUDE_DIRS

    path = Path(file_path)
    parts = set(path.parts)

    if parts & exclude_dirs:
        return True

    for ext in DEFAULT_EXCLUDE_EXTENSIONS:
        if file_path.endswith(ext):
            return True

    if path.name.startswith(".") and path.name not in {".gitignore", ".dockerignore", ".env.example"}:
        return True

    return False


def compute_file_hash(content: bytes) -> str:
    """Compute SHA256 hash of file content."""
    return hashlib.sha256(content).hexdigest()[:128]


def clone_repository(clone_url: str, target_dir: str, branch: str = "main", github_token: Optional[str] = None) -> str:
    """Clone a repository and return the commit SHA."""
    env = os.environ.copy()
    gitconfig_path = None
    
    if github_token:
        # Prevent token leakage in command line args by using a temporary global git config
        fd, gitconfig_path = tempfile.mkstemp(prefix="gitconfig_")
        with os.fdopen(fd, 'w') as f:
            # We specifically target github.com, but if clone_url has a different host, 
            # this header is ignored. It's safe for github endpoints.
            f.write(f'[http "https://github.com"]\n\textraHeader = Authorization: Bearer {github_token}\n')
        env["GIT_CONFIG_GLOBAL"] = gitconfig_path
        # Prevent interactive prompts if token fails
        env["GIT_TERMINAL_PROMPT"] = "0"

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
            raise GitError(f"Failed to get commit SHA: {commit_result.stderr}")

        return commit_result.stdout.strip()
    except subprocess.TimeoutExpired:
        raise GitError("Git operation timed out")
    except FileNotFoundError:
        raise GitError("Git not found in PATH")
    finally:
        if gitconfig_path and os.path.exists(gitconfig_path):
            try:
                os.remove(gitconfig_path)
            except OSError:
                pass


def discover_files(root_dir: str) -> List[Tuple[str, str]]:
    """Discover all files in the repository that should be indexed.
    Returns list of (relative_path, absolute_path) tuples.

    Security: symlinks are skipped entirely and resolved paths are verified
    to remain inside the repository root to prevent path traversal attacks.
    """
    files = []
    root = Path(root_dir).resolve()

    for file_path in root.rglob("*"):
        # Skip any symlink (file or directory) to prevent escape
        if file_path.is_symlink():
            continue

        if not file_path.is_file():
            continue

        # Resolve the real path and ensure it is inside the root
        try:
            resolved = file_path.resolve()
            resolved.relative_to(root)
        except (ValueError, OSError):
            continue

        try:
            rel_path = file_path.relative_to(root).as_posix()
        except ValueError:
            continue

        if should_exclude_file(rel_path):
            continue

        language = get_language_for_file(rel_path)
        if language is None:
            continue

        files.append((rel_path, str(resolved)))

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

                self._analyze_repository(version)
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
            self._update_job_status(job.id, "FAILED", str(e))
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

    def _update_job_status(self, job_id: UUID, status: str, error_message: Optional[str] = None) -> None:
        """Update the index job status."""
        from datetime import datetime, timezone

        job = self.repository_repo.get_job_by_id(job_id)
        if job:
            job.status = status
            job.error_message = error_message
            if status in ("FETCHING", "INDEXING", "ANALYZING") and not job.started_at:
                job.started_at = datetime.now(timezone.utc)
            if status in ("READY", "FAILED"):
                job.completed_at = datetime.now(timezone.utc)
            self.db.commit()

    def _index_repository(self, repo_path: str, version: RepositoryVersion) -> None:
        """Index all files in the repository, then run symbol extraction."""
        from sqlalchemy import select as sa_select
        from app.repositories.knowledge import KnowledgeRepository
        from app.services.symbol_extractor import SymbolExtractorService

        knowledge_repo = KnowledgeRepository(self.db)

        # --- Re-index cleanup: remove existing data for this version ---
        deleted_count = knowledge_repo.delete_files_for_version(version.id)
        if deleted_count > 0:
            logger.info(f"Re-index: removed {deleted_count} existing files for version {version.id}")
        knowledge_repo.delete_analysis_results_for_version(version.id)

        files = discover_files(repo_path)
        logger.info(f"Discovered {len(files)} files to index for version {version.id}")

        for rel_path, abs_path in files:
            self._index_file(repo_path, rel_path, abs_path, version)

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
        if indexed_files:
            from app.services.chunking import ChunkBuilderService
            chunk_service = ChunkBuilderService(knowledge_repo, repo_path)
            chunk_stats = chunk_service.build_chunks(version, indexed_files)
            logger.info(
                f"Chunk building complete for version {version.id}: "
                f"{chunk_stats['chunks_created']} chunks created from "
                f"{chunk_stats['files_processed']} files"
            )

        # --- Embedding Generation ---
        if indexed_files and self.embedding_service:
            try:
                from app.models.knowledge import CodeChunk
                from sqlalchemy.orm import joinedload
                
                stmt = sa_select(CodeChunk).where(
                    CodeChunk.file_id.in_([f.id for f in indexed_files])
                )
                stmt = stmt.options(joinedload(CodeChunk.file), joinedload(CodeChunk.symbol))
                
                new_chunks = list(self.db.execute(stmt).scalars().unique().all())
                
                if new_chunks:
                    embedding_stats = self.embedding_service.generate_and_store_embeddings(new_chunks)
                    logger.info(
                        f"Embedding generation complete for version {version.id}: "
                        f"{embedding_stats['embeddings_created']} embeddings created."
                    )
            except Exception as e:
                logger.error(f"Embedding generation failed: {str(e)}")
                raise EmbeddingError(f"Embedding generation failed: {str(e)}") from e

        self.db.commit()

    def _index_file(self, repo_root: str, rel_path: str, abs_path: str, version: RepositoryVersion) -> None:
        """Index a single file."""
        content, file_hash = read_file_content(abs_path)
        language = get_language_for_file(rel_path) or "text"

        file_record = File(
            repository_version_id=version.id,
            file_path=rel_path,
            file_name=Path(rel_path).name,
            language=language,
            size_bytes=len(content.encode("utf-8")),
            hash=file_hash,
        )
        self.db.add(file_record)
        self.db.flush()

        # Symbol extraction is handled in bulk by SymbolExtractorService
        # after all files for this version have been indexed.
        # Chunking is similarly handled in bulk.

    def _analyze_repository(self, version: RepositoryVersion) -> None:
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

        tech_analysis = AnalysisResult(
            repository_version_id=version.id,
            analysis_type="TECH_STACK",
            payload={"languages": [lang for lang, _ in languages]},
        )
        self.db.add(tech_analysis)

        self.db.commit()