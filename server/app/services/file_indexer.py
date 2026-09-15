import os
import hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import Set
import logging
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.repository import RepositoryVersion
from app.models.knowledge import File
from app.repositories.knowledge import KnowledgeRepository
from app.core.config import settings

logger = logging.getLogger(__name__)

IGNORED_DIRECTORIES = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "coverage", ".pytest_cache", ".mypy_cache", ".ruff_cache"
}

KNOWN_BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
    ".zip", ".gz", ".tar", ".mp4", ".mp3", ".exe", ".dll", ".so",
    ".class", ".pyc"
}

EXTENSION_LANGUAGE_MAP = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".cpp": "C++",
    ".hpp": "C++",
    ".c": "C",
    ".h": "C",
    ".cs": "C#",
    ".md": "Markdown",
    ".mdx": "Markdown",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SASS",
    ".rb": "Ruby",
    ".php": "PHP",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".swift": "Swift",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".toml": "TOML",
    ".xml": "XML",
    ".ini": "INI",
    ".env": "Env",
    ".txt": "Text",
}

@dataclass
class FileIndexingResult:
    files_discovered: int = 0
    files_indexed: int = 0
    files_skipped: int = 0
    bytes_indexed: int = 0

class RepositoryFileIndexer:
    def __init__(self, db: Session):
        self.db = db
        self.knowledge_repo = KnowledgeRepository(db)
        self.max_size_bytes = settings.MAX_INDEXABLE_FILE_SIZE_BYTES

    def compute_sha256(self, file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def is_binary_content(self, file_path: Path) -> bool:
        try:
            with open(file_path, "rb") as f:
                chunk = f.read(1024)
                if b"\x00" in chunk:
                    return True
            return False
        except Exception:
            return True

    def index_snapshot(
        self,
        repository_version: RepositoryVersion,
        snapshot_root: Path
    ) -> FileIndexingResult:
        result = FileIndexingResult()
        files_to_insert = []
        
        stmt = select(File.file_path).where(File.repository_version_id == repository_version.id)
        existing_paths: Set[str] = {row for row in self.db.execute(stmt).scalars().all()}
        
        for dirpath_str, dirnames, filenames in os.walk(str(snapshot_root)):
            dirnames.sort()
            filenames.sort()
            
            dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRECTORIES]
            
            dirpath = Path(dirpath_str)
            
            for filename in filenames:
                result.files_discovered += 1
                file_path = dirpath / filename
                
                try:
                    rel_path = file_path.relative_to(snapshot_root)
                except ValueError:
                    result.files_skipped += 1
                    continue
                
                posix_path = rel_path.as_posix()
                
                if posix_path in existing_paths:
                    result.files_skipped += 1
                    continue
                
                try:
                    file_size = file_path.stat().st_size
                except OSError:
                    result.files_skipped += 1
                    continue
                    
                if file_size > self.max_size_bytes:
                    result.files_skipped += 1
                    continue
                    
                ext = file_path.suffix.lower()
                if ext in KNOWN_BINARY_EXTENSIONS:
                    result.files_skipped += 1
                    continue
                    
                language = EXTENSION_LANGUAGE_MAP.get(ext)
                if not language:
                    if self.is_binary_content(file_path):
                        result.files_skipped += 1
                        continue
                    language = "Unknown"
                
                try:
                    content_hash = self.compute_sha256(file_path)
                except OSError:
                    result.files_skipped += 1
                    continue
                    
                file_record = File(
                    repository_version_id=repository_version.id,
                    file_path=posix_path,
                    file_name=filename,
                    language=language,
                    size_bytes=file_size,
                    hash=content_hash
                )
                files_to_insert.append(file_record)
                
                result.files_indexed += 1
                result.bytes_indexed += file_size
                existing_paths.add(posix_path)

        if files_to_insert:
            self.knowledge_repo.bulk_create_files(files_to_insert)

        return result
