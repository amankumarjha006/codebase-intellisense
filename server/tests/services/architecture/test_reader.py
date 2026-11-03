"""Unit tests for secure repository file reader."""

from pathlib import Path
from unittest.mock import patch
import pytest

from app.services.architecture.reader import create_repo_reader


def test_reader_normal_file(tmp_path: Path):
    test_file = tmp_path / "src" / "main.py"
    test_file.parent.mkdir(parents=True)
    test_file.write_text("print('hello')", encoding="utf-8")

    reader = create_repo_reader(tmp_path)
    content = reader("src/main.py")
    assert content == "print('hello')"


def test_reader_rejects_path_traversal(tmp_path: Path):
    reader = create_repo_reader(tmp_path)
    with pytest.raises(ValueError, match="Path outside repository"):
        reader("../outside.py")

    with pytest.raises(ValueError, match="Path outside repository"):
        reader("/etc/passwd")


def test_reader_rejects_size_limit_exceeded(tmp_path: Path):
    big_file = tmp_path / "big.bin"
    big_file.write_text("x" * 2000, encoding="utf-8")

    reader = create_repo_reader(tmp_path, max_bytes=1000)
    with pytest.raises(ValueError, match="File exceeds maximum size"):
        reader("big.bin")


def test_reader_refuses_symlink_mocked_islink(tmp_path: Path):
    """Verify symlink refusal passes on Windows via mock of os.path.islink."""
    file_path = tmp_path / "link.py"
    file_path.write_text("print('mocked')", encoding="utf-8")

    reader = create_repo_reader(tmp_path)
    with patch("os.path.islink", return_value=True):
        with pytest.raises(ValueError, match="Symlinks are not allowed"):
            reader("link.py")


def test_reader_refuses_symlink_mocked_is_symlink(tmp_path: Path):
    """Verify symlink refusal passes on Windows via mock of Path.is_symlink."""
    file_path = tmp_path / "link.py"
    file_path.write_text("print('mocked')", encoding="utf-8")

    reader = create_repo_reader(tmp_path)
    with patch.object(Path, "is_symlink", return_value=True):
        with pytest.raises(ValueError, match="Symlinks are not allowed"):
            reader("link.py")


def test_reader_file_not_found(tmp_path: Path):
    reader = create_repo_reader(tmp_path)
    with pytest.raises(FileNotFoundError, match="File not found"):
        reader("nonexistent.py")

