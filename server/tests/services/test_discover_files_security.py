"""Security tests for discover_files symlink and path traversal protection."""
import os
import pytest
import tempfile
from pathlib import Path

from app.services.indexing import discover_files


@pytest.fixture
def repo_with_symlinks(tmp_path):
    """Create a repo directory with various symlink attack vectors."""
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()

    outside_dir = tmp_path / "outside"
    outside_dir.mkdir()

    # Normal file that should be indexed
    safe_py = repo_dir / "safe.py"
    safe_py.write_text("x = 1\n")

    # Secret file outside the repo
    secret_py = outside_dir / "secret.py"
    secret_py.write_text("SECRET_KEY = 'leaked'\n")

    # Symlink to file outside root
    leaked_link = repo_dir / "leaked.py"
    leaked_link_created = False
    try:
        leaked_link.symlink_to(secret_py)
        leaked_link_created = True
    except OSError:
        pass

    # Symlink to directory outside root
    outside_dir_link = repo_dir / "escape_dir"
    escape_dir_created = False
    try:
        outside_dir_link.symlink_to(outside_dir)
        escape_dir_created = True
    except OSError:
        pass

    # Broken symlink
    broken_link = repo_dir / "broken.py"
    broken_link_created = False
    try:
        broken_link.symlink_to(tmp_path / "nonexistent.py")
        broken_link_created = True
    except OSError:
        pass

    # Internal symlink (to a file inside the repo)
    internal_link = repo_dir / "internal.py"
    internal_link_created = False
    try:
        internal_link.symlink_to(safe_py)
        internal_link_created = True
    except OSError:
        pass

    return {
        "repo_dir": str(repo_dir),
        "outside_dir": str(outside_dir),
        "secret_content": "SECRET_KEY = 'leaked'\n",
        "leaked_link_created": leaked_link_created,
        "escape_dir_created": escape_dir_created,
        "broken_link_created": broken_link_created,
        "internal_link_created": internal_link_created,
    }


def test_symlink_to_outside_file_is_excluded(repo_with_symlinks):
    """A symlink pointing outside the repo must NOT be indexed."""
    if not repo_with_symlinks.get("leaked_link_created"):
        pytest.skip("Cannot create symlinks on this platform")
    files = discover_files(repo_with_symlinks["repo_dir"])
    paths = [rel for rel, _ in files]
    assert "leaked.py" not in paths


def test_symlink_to_outside_directory_is_excluded(repo_with_symlinks):
    """Files inside a symlinked directory pointing outside repo must NOT be indexed."""
    if not repo_with_symlinks.get("escape_dir_created"):
        pytest.skip("Cannot create symlinks on this platform")
    files = discover_files(repo_with_symlinks["repo_dir"])
    paths = [rel for rel, _ in files]
    # The escape_dir/secret.py should not appear
    for p in paths:
        assert not p.startswith("escape_dir/")


def test_broken_symlink_is_excluded(repo_with_symlinks):
    """A broken symlink must NOT cause an error and must be excluded."""
    if not repo_with_symlinks.get("broken_link_created"):
        pytest.skip("Cannot create symlinks on this platform")
    files = discover_files(repo_with_symlinks["repo_dir"])
    paths = [rel for rel, _ in files]
    assert "broken.py" not in paths


def test_internal_symlink_is_excluded(repo_with_symlinks):
    """Even internal symlinks are skipped (MVP simplicity)."""
    if not repo_with_symlinks.get("internal_link_created"):
        pytest.skip("Cannot create symlinks on this platform")
    files = discover_files(repo_with_symlinks["repo_dir"])
    paths = [rel for rel, _ in files]
    assert "internal.py" not in paths


def test_normal_file_is_included(repo_with_symlinks):
    """Normal files inside the repo must still be indexed."""
    files = discover_files(repo_with_symlinks["repo_dir"])
    paths = [rel for rel, _ in files]
    assert "safe.py" in paths


def test_outside_content_never_read(repo_with_symlinks):
    """The absolute paths returned must never point outside the repo root."""
    files = discover_files(repo_with_symlinks["repo_dir"])
    repo_root = Path(repo_with_symlinks["repo_dir"]).resolve()
    for _, abs_path in files:
        resolved = Path(abs_path).resolve()
        # This must not raise
        resolved.relative_to(repo_root)

        # Content must not be the secret
        content = resolved.read_text()
        assert repo_with_symlinks["secret_content"] not in content
