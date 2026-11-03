"""Secure repository file reader with containment and symlink refusal."""

import os
from pathlib import Path
from .types import FileReader

MAX_FILE_SIZE_BYTES = 1_048_576  # 1 MB per file cap


def create_repo_reader(repo_path: str | Path, max_bytes: int = MAX_FILE_SIZE_BYTES) -> FileReader:
    """Create a secure reader function that enforces realpath containment under repo_path,

    refuses symlinks, and enforces maximum file size cap.
    """
    base = Path(repo_path).resolve()
    base_realpath = os.path.realpath(str(base))

    def read_file(rel_path: str) -> str:
        # Normalize relative path and reject absolute paths or upward traversal
        normalized = os.path.normpath(rel_path).replace("\\", "/")
        if (
            normalized.startswith("/")
            or normalized.startswith("../")
            or normalized == ".."
            or os.path.isabs(normalized)
        ):
            raise ValueError(f"Path outside repository: {rel_path}")

        full_path = (base / normalized).resolve(strict=False)
        full_str = str(full_path)

        # Check symlink on the target path
        if os.path.islink(full_str) or full_path.is_symlink():
            raise ValueError(f"Symlinks are not allowed: {rel_path}")

        # Check realpath containment under base_realpath
        target_realpath = os.path.realpath(full_str)
        if not (target_realpath == base_realpath or target_realpath.startswith(base_realpath + os.sep)):
            raise ValueError(f"Path traversal detected: {rel_path}")

        # Check intermediate directories for symlinks
        curr = full_path.parent
        while curr != base and len(curr.parts) >= len(base.parts):
            if os.path.islink(str(curr)) or curr.is_symlink():
                raise ValueError(f"Symlinks in path not allowed: {rel_path}")
            curr = curr.parent

        if not full_path.is_file():
            raise FileNotFoundError(f"File not found: {rel_path}")

        # Enforce file size limit
        file_size = full_path.stat().st_size
        if file_size > max_bytes:
            raise ValueError(f"File exceeds maximum size ({file_size} > {max_bytes} bytes): {rel_path}")

        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    return read_file
