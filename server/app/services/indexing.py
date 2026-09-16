import logging
import os
import hashlib
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge import (
    CodeChunk,
    Embedding,
    File,
    FileRelationship,
    Symbol,
    SymbolRelationship,
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


def clone_repository(clone_url: str, target_dir: str, branch: str = "main") -> str:
    """Clone a repository and return the commit SHA."""
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", branch, clone_url, target_dir],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            raise GitError(f"Failed to clone repository: {result.stderr}")

        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if commit_result.returncode != 0:
            raise GitError(f"Failed to get commit SHA: {commit_result.stderr}")

        return commit_result.stdout.strip()
    except subprocess.TimeoutExpired:
        raise GitError("Git operation timed out")
    except FileNotFoundError:
        raise GitError("Git not found in PATH")


def discover_files(root_dir: str) -> List[Tuple[str, str]]:
    """Discover all files in the repository that should be indexed.
    Returns list of (relative_path, absolute_path) tuples.
    """
    files = []
    root = Path(root_dir).resolve()

    for file_path in root.rglob("*"):
        if not file_path.is_file():
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

        files.append((rel_path, str(file_path)))

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


class TreeSitterParser:
    """Tree-sitter based code parser for extracting symbols and relationships."""

    def __init__(self):
        self._parsers: Dict[str, any] = {}
        self._queries: Dict[str, any] = {}

    def _get_parser(self, language: str):
        """Get or create a Tree-sitter parser for the given language."""
        if language in self._parsers:
            return self._parsers[language]

        try:
            from tree_sitter_languages import get_parser
            parser = get_parser(language)
            self._parsers[language] = parser
            return parser
        except Exception as e:
            logger.warning(f"Failed to load parser for {language}: {e}")
            return None

    def _get_query(self, language: str, query_name: str):
        """Get or create a Tree-sitter query for the given language."""
        key = f"{language}:{query_name}"
        if key in self._queries:
            return self._queries[key]

        try:
            from tree_sitter_languages import get_query
            query = get_query(language, query_name)
            self._queries[key] = query
            return query
        except Exception as e:
            logger.warning(f"Failed to load query {query_name} for {language}: {e}")
            return None

    def parse(self, content: str, language: str):
        """Parse content and return the Tree-sitter tree."""
        parser = self._get_parser(language)
        if parser is None:
            return None

        try:
            tree = parser.parse(content.encode("utf-8"))
            return tree
        except Exception as e:
            logger.warning(f"Failed to parse {language} content: {e}")
            return None

    def extract_symbols(self, tree, content: str, language: str, file_id: UUID) -> List[Dict]:
        """Extract symbols (functions, classes, etc.) from the parsed tree."""
        symbols = []

        query = self._get_query(language, "symbols")
        if query is None:
            return symbols

        try:
            captures = query.captures(tree.root_node)
            for node, capture_name in captures:
                if capture_name in ("function", "method", "class", "interface", "struct", "enum"):
                    start_line = node.start_point[0] + 1
                    end_line = node.end_point[0] + 1
                    name = self._get_node_name(node, content)
                    qualified_name = self._get_qualified_name(node, content, language)

                    if name:
                        symbols.append({
                            "name": name,
                            "qualified_name": qualified_name or name,
                            "symbol_type": capture_name.upper(),
                            "start_line": start_line,
                            "end_line": end_line,
                            "file_id": file_id,
                        })
        except Exception as e:
            logger.warning(f"Failed to extract symbols for {language}: {e}")

        return symbols

    def _get_node_name(self, node, content: str) -> Optional[str]:
        """Extract the name of a symbol node."""
        for child in node.children:
            if child.type in ("identifier", "type_identifier", "name"):
                return content[child.start_byte:child.end_byte]
        return None

    def _get_qualified_name(self, node, content: str, language: str) -> Optional[str]:
        """Extract the qualified name including parent scopes."""
        parts = []
        current = node
        while current:
            name = self._get_node_name(current, content)
            if name:
                parts.append(name)
            if current.type in ("module", "program", "source_file"):
                break
            current = current.parent
        return ".".join(reversed(parts)) if parts else None

    def extract_imports(self, tree, content: str, language: str) -> List[str]:
        """Extract import statements from the parsed tree."""
        imports = []

        query = self._get_query(language, "imports")
        if query is None:
            return imports

        try:
            captures = query.captures(tree.root_node)
            for node, capture_name in captures:
                if capture_name in ("import", "module", "package"):
                    import_text = content[node.start_byte:node.end_byte]
                    imports.append(import_text.strip())
        except Exception as e:
            logger.warning(f"Failed to extract imports for {language}: {e}")

        return imports

    def extract_calls(self, tree, content: str, language: str) -> List[Dict]:
        """Extract function/method calls from the parsed tree."""
        calls = []

        query = self._get_query(language, "calls")
        if query is None:
            return calls

        try:
            captures = query.captures(tree.root_node)
            for node, capture_name in captures:
                if capture_name in ("call", "function_call", "method_call"):
                    name = self._get_node_name(node, content)
                    if name:
                        calls.append({
                            "name": name,
                            "start_line": node.start_point[0] + 1,
                            "end_line": node.end_point[0] + 1,
                        })
        except Exception as e:
            logger.warning(f"Failed to extract calls for {language}: {e}")

        return calls



class IndexingService:
    """Main service for repository indexing pipeline."""

    def __init__(self, db: Session):
        self.db = db
        self.repository_repo = RepositoryRepository(db)
        self.parser = TreeSitterParser()

    def run_indexing(self, job: IndexJob) -> None:
        """Run the full indexing pipeline for a job."""
        repository = self.repository_repo.get_by_id(job.repository_id)
        if not repository:
            raise IndexingError(f"Repository {job.repository_id} not found")

        version = self.repository_repo.get_version_by_id(job.repository_version_id)
        if not version:
            raise IndexingError(f"Repository version {job.repository_version_id} not found")

        try:
            self._update_job_status(job.id, "FETCHING")
            self.db.commit()

            repo_path = self._fetch_repository(repository, version)

            self._update_job_status(job.id, "INDEXING")
            self.db.commit()

            self._index_repository(repo_path, version)

            self._update_job_status(job.id, "ANALYZING")
            self.db.commit()

            self._analyze_repository(version)

            self._update_job_status(job.id, "READY")
            version.index_status = "SUCCESS"
            from datetime import datetime, timezone
            version.indexed_at = datetime.now(timezone.utc)
            self.db.commit()

        except Exception as e:
            logger.error(f"Indexing failed for job {job.id}: {e}")
            self._update_job_status(job.id, "FAILED", str(e))
            version.index_status = "FAILED"
            self.db.commit()
            raise
        finally:
            self._cleanup_repo(repo_path)

    def _fetch_repository(self, repository: Repository, version: RepositoryVersion) -> str:
        """Clone the repository to a temporary directory."""
        temp_dir = tempfile.mkdtemp(prefix=f"index_{repository.id}_")
        try:
            clone_repository(repository.clone_url, temp_dir, version.branch)
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

        files = discover_files(repo_path)
        logger.info(f"Discovered {len(files)} files to index for version {version.id}")

        for rel_path, abs_path in files:
            self._index_file(repo_path, rel_path, abs_path, version)

        # --- Symbol extraction ---
        # Query all files flushed during this index run before committing.
        stmt = sa_select(File).where(File.repository_version_id == version.id)
        indexed_files = list(self.db.execute(stmt).scalars().all())
        if indexed_files:
            knowledge_repo = KnowledgeRepository(self.db)
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
        if indexed_files:
            from app.services.embedding.factory import get_embedding_provider
            from app.services.embedding.service import EmbeddingService
            from app.core.config import settings
            
            try:
                # Get the CodeChunks created for the indexed files
                # Note: chunk_service.build_chunks handles idempotency by deleting chunks
                # Because of ON DELETE CASCADE, old embeddings are already gone.
                # We just need to load the new chunks to embed them.
                from app.models.knowledge import CodeChunk
                from sqlalchemy import select as sa_select
                
                stmt = sa_select(CodeChunk).where(
                    CodeChunk.file_id.in_([f.id for f in indexed_files])
                )
                
                # Eagerly load file and symbol because text builder needs them
                from sqlalchemy.orm import joinedload
                stmt = stmt.options(joinedload(CodeChunk.file), joinedload(CodeChunk.symbol))
                
                new_chunks = list(self.db.execute(stmt).scalars().all())
                
                if new_chunks:
                    provider = get_embedding_provider(settings)
                    embedding_service = EmbeddingService(knowledge_repo, provider)
                    embedding_stats = embedding_service.generate_and_store_embeddings(new_chunks)
                    
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

    def _extract_and_store_symbols(self, tree, content: str, language: str, file_record: File) -> None:
        """Extract and store symbols from the parsed tree."""
        symbols_data = self.parser.extract_symbols(tree, content, language, file_record.id)

        for symbol_data in symbols_data:
            symbol = Symbol(**symbol_data)
            self.db.add(symbol)

    def _extract_and_store_relationships(self, tree, content: str, language: str, file_record: File, version: RepositoryVersion) -> None:
        """Extract and store relationships (imports, calls) from the parsed tree."""
        imports = self.parser.extract_imports(tree, content, language)
        calls = self.parser.extract_calls(tree, content, language)

        for import_stmt in imports:
            rel = FileRelationship(
                repository_version_id=version.id,
                source_file_id=file_record.id,
                target_file_id=file_record.id,
                relationship_type="IMPORTS",
            )
            self.db.add(rel)

        for call in calls:
            pass

    def _analyze_repository(self, version: RepositoryVersion) -> None:
        """Run repository-level analysis (tech stack, architecture, statistics)."""
        from app.models.knowledge import AnalysisResult
        from sqlalchemy import func

        file_count = self.db.query(func.count(File.id)).filter(File.repository_version_id == version.id).scalar()
        symbol_count = self.db.query(func.count(Symbol.id)).join(File).filter(File.repository_version_id == version.id).scalar()
        chunk_count = self.db.query(func.count(CodeChunk.id)).join(File).filter(File.repository_version_id == version.id).scalar()

        languages = self.db.query(File.language, func.count(File.id)).filter(
            File.repository_version_id == version.id
        ).group_by(File.language).all()

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