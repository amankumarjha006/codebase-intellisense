import os
import subprocess
from unittest.mock import MagicMock, patch
import pytest

from app.services.indexing import clone_repository, GitError


def test_clone_repository_with_token_does_not_create_disk_files():
    """Verify that cloning with a GitHub token does NOT write any gitconfig files to disk."""
    fake_token = "ghp_SECRET_TOKEN_12345"
    captured_envs = []

    def fake_subprocess_run(cmd, *args, **kwargs):
        captured_envs.append(kwargs.get("env", {}))
        mock_res = MagicMock()
        mock_res.returncode = 0
        if "rev-parse" in cmd:
            mock_res.stdout = "abc1234def\n"
        else:
            mock_res.stdout = ""
        mock_res.stderr = ""
        return mock_res

    with patch("tempfile.mkstemp") as mock_mkstemp, \
         patch("subprocess.run", side_effect=fake_subprocess_run):
        
        sha = clone_repository(
            clone_url="https://github.com/testowner/testrepo.git",
            target_dir="/tmp/fake_dir",
            branch="main",
            github_token=fake_token,
        )

        assert sha == "abc1234def"
        # Crucial security assertion: tempfile.mkstemp MUST NOT be called
        mock_mkstemp.assert_not_called()

        # Verify token was passed securely via in-memory env parameters
        assert len(captured_envs) >= 1
        env = captured_envs[0]
        assert env.get("GIT_TERMINAL_PROMPT") == "0"
        assert env.get("GIT_CONFIG_COUNT") == "1"
        assert env.get("GIT_CONFIG_KEY_0") == "http.extraHeader"
        assert env.get("GIT_CONFIG_VALUE_0") == f"Authorization: Bearer {fake_token}"
        assert f"Authorization: Bearer {fake_token}" in env.get("GIT_CONFIG_PARAMETERS", "")


def test_clone_repository_redacts_token_on_failure():
    """Verify that if git clone fails, the GitHub token is redacted from the error message."""
    fake_token = "ghp_SUPER_SECRET_TOKEN"

    def fake_subprocess_run(cmd, *args, **kwargs):
        mock_res = MagicMock()
        mock_res.returncode = 128
        mock_res.stdout = ""
        mock_res.stderr = f"fatal: Authentication failed for token {fake_token}"
        return mock_res

    with patch("subprocess.run", side_effect=fake_subprocess_run):
        with pytest.raises(GitError) as exc_info:
            clone_repository(
                clone_url="https://github.com/testowner/testrepo.git",
                target_dir="/tmp/fake_dir",
                branch="main",
                github_token=fake_token,
            )

        err_msg = str(exc_info.value)
        assert fake_token not in err_msg
        assert "***" in err_msg
