import pytest
import io
import os
import tarfile
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.github import GithubService, GithubAuthError, GithubArchiveError

def create_tarball(files, include_wrapper=True):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        # Always add the wrapper dir first if requested
        if include_wrapper:
            dir_info = tarfile.TarInfo(name="owner-repo-sha123")
            dir_info.type = tarfile.DIRTYPE
            tar.addfile(dir_info)
            
        for name, content, type_ in files:
            path = f"owner-repo-sha123/{name}" if include_wrapper else name
            if type_ == "reg":
                info = tarfile.TarInfo(name=path)
                info.size = len(content)
                info.type = tarfile.REGTYPE
                tar.addfile(info, io.BytesIO(content))
            elif type_ == "sym":
                info = tarfile.TarInfo(name=path)
                info.type = tarfile.SYMTYPE
                info.linkname = content
                tar.addfile(info)
            elif type_ == "dir":
                info = tarfile.TarInfo(name=path)
                info.type = tarfile.DIRTYPE
                tar.addfile(info)
    return buf.getvalue()

@pytest.fixture
def github_service():
    return GithubService()

class MockResponse:
    def __init__(self, status_code, content):
        self.status_code = status_code
        self._content = content

    async def aiter_bytes(self, chunk_size=None):
        yield self._content

class MockStreamContextManager:
    def __init__(self, response):
        self.response = response

    async def __aenter__(self):
        return self.response

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class FakeClient:
    def __init__(self, response):
        self.response = response
    async def __aenter__(self):
        return self
    async def __aexit__(self, *args):
        pass
    def stream(self, method, url, **kwargs):
        return MockStreamContextManager(self.response)

@pytest.mark.asyncio
async def test_download_snapshot_success(github_service, mocker):
    tar_data = create_tarball([("README.md", b"Hello", "reg")])
    mock_resp = MockResponse(200, tar_data)
    
    with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
        snapshot = await github_service.download_repository_snapshot("token", "owner", "repo", "sha123")
        
        assert snapshot.path.exists()
        assert snapshot.root.exists()
        assert (snapshot.root / "README.md").exists()
        assert (snapshot.root / "README.md").read_text() == "Hello"
        
        # Verify tar.gz is deleted
        assert not (snapshot.path / "archive.tar.gz").exists()
        
        snapshot.cleanup()
        assert not snapshot.path.exists()

@pytest.mark.asyncio
async def test_download_snapshot_not_found(github_service, mocker):
    mock_resp = MockResponse(404, b"")
    
    with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
        with pytest.raises(GithubAuthError, match="not found"):
            await github_service.download_repository_snapshot("token", "owner", "repo", "sha123")

@pytest.mark.asyncio
async def test_download_snapshot_malformed(github_service, mocker):
    mock_resp = MockResponse(200, b"not a tarball")
    
    with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
        with pytest.raises(GithubArchiveError, match="Failed to parse"):
            await github_service.download_repository_snapshot("token", "owner", "repo", "sha123")

@pytest.mark.asyncio
async def test_download_snapshot_missing_wrapper(github_service, mocker):
    tar_data = create_tarball([("README.md", b"Hello", "reg")], include_wrapper=False)
    mock_resp = MockResponse(200, tar_data)
    
    with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
        with pytest.raises(GithubArchiveError, match="Archive does not have a single top-level directory wrapper"):
            # Because include_wrapper=False, the first part is "README.md", meaning wrapper_prefix is "README.md".
            # Wait, if there are multiple files, it raises the multiple top level directories error.
            # If there's just one file, wrapper_prefix is the filename, but then it fails later when trying to extract files inside it.
            # Let's add two files to ensure it raises the right error.
            tar_data = create_tarball([("README.md", b"Hello", "reg"), ("LICENSE", b"MIT", "reg")], include_wrapper=False)
            mock_resp = MockResponse(200, tar_data)
            with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
                await github_service.download_repository_snapshot("token", "owner", "repo", "sha123")

@pytest.mark.asyncio
async def test_download_snapshot_path_traversal(github_service, mocker):
    tar_data = create_tarball([("../evil.txt", b"evil", "reg")])
    mock_resp = MockResponse(200, tar_data)
    
    with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
        with pytest.raises(GithubArchiveError, match="Suspicious path"):
            await github_service.download_repository_snapshot("token", "owner", "repo", "sha123")

@pytest.mark.asyncio
async def test_download_snapshot_absolute_path(github_service, mocker):
    # Construct a tarball with an absolute path manually because create_tarball prepends wrapper
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        dir_info = tarfile.TarInfo(name="wrapper")
        dir_info.type = tarfile.DIRTYPE
        tar.addfile(dir_info)
        info = tarfile.TarInfo(name="/etc/passwd")
        info.size = 4
        tar.addfile(info, io.BytesIO(b"evil"))
    
    mock_resp = MockResponse(200, buf.getvalue())
    
    with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
        with pytest.raises(GithubArchiveError, match="Suspicious path|single top-level"):
            await github_service.download_repository_snapshot("token", "owner", "repo", "sha123")

@pytest.mark.asyncio
async def test_download_snapshot_symlink(github_service, mocker):
    tar_data = create_tarball([("link.txt", "/etc/passwd", "sym")])
    mock_resp = MockResponse(200, tar_data)
    
    with patch("httpx.AsyncClient", return_value=FakeClient(mock_resp)):
        with pytest.raises(GithubArchiveError, match="Symlinks are not allowed"):
            await github_service.download_repository_snapshot("token", "owner", "repo", "sha123")
