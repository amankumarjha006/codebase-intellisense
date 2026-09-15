import httpx
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from app.core.config import settings
import logging
import tempfile
import tarfile
import shutil
import os
from pathlib import Path
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class GithubAuthError(Exception):
    """Exception raised for GitHub API errors during authentication."""
    pass

class GithubArchiveError(Exception):
    """Exception raised for repository archive download or extraction failures."""
    pass

@dataclass
class RepositorySnapshot:
    path: Path  # This is the root temporary directory containing the extraction

    @property
    def root(self) -> Path:
        """The actual extracted repository root, ignoring the parent temporary directory."""
        return self.path / "extracted"

    def cleanup(self):
        """Remove the temporary snapshot directory."""
        if self.path.exists():
            shutil.rmtree(self.path, ignore_errors=True)

class GithubService:
    def __init__(self):
        self.client_id = settings.GITHUB_CLIENT_ID
        self.client_secret = settings.GITHUB_CLIENT_SECRET
        self.callback_url = settings.GITHUB_CALLBACK_URL

    def get_authorization_url(self, state: str) -> str:
        """Construct the GitHub App user authorization URL."""
        if not self.client_id:
            raise ValueError("GITHUB_CLIENT_ID is not configured.")
            
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.callback_url,
            "state": state,
            "scope": "user:email",
            # For GitHub Apps, we generally don't need to request scopes for user-to-server 
            # if we are just identifying the user, but we might want user:email to ensure 
            # we can read the email address if it's private.
        }
        query_string = urlencode(params)
        logger.info("OAuth Authorization URL requested scope: '%s'", params["scope"])
        return f"https://github.com/login/oauth/authorize?{query_string}"

    async def exchange_code_for_token(self, code: str) -> str:
        """Exchange the authorization code for a User Access Token."""
        if not self.client_id or not self.client_secret:
            raise ValueError("GitHub credentials not fully configured.")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.callback_url,
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                logger.error("GitHub token exchange failed with status %s", response.status_code)
                raise GithubAuthError("Failed to exchange authorization code.")
                
            data = response.json()
            if "error" in data:
                logger.error(
                    "GitHub returned an error during code exchange: %s", data.get("error")
                )
                raise GithubAuthError(data.get("error_description", data.get("error")))
                
            granted_scopes = data.get("scope", "")
            token_type = data.get("token_type", "")
            logger.info("OAuth Token Exchange HTTP status: %s", response.status_code)
            logger.info("OAuth Token Exchange requested scope: 'user:email'")
            logger.info("OAuth Token Exchange granted scope: '%s'", granted_scopes)
            logger.info("OAuth Token Exchange token_type: '%s'", token_type)
            return data["access_token"]

    async def get_authenticated_user(self, access_token: str) -> Dict[str, Any]:
        """
        Fetch the authenticated GitHub user's profile and explicitly find their primary email.
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        async with httpx.AsyncClient() as client:
            # 1. Get basic profile
            profile_resp = await client.get("https://api.github.com/user", headers=headers, timeout=10.0)
            if profile_resp.status_code != 200:
                logger.error(
                    "Failed to fetch GitHub user profile with status %s", profile_resp.status_code
                )
                raise GithubAuthError("Failed to retrieve user profile from GitHub.")
                
            profile = profile_resp.json()
            
            # 2. Get verified primary email
            emails_resp = await client.get("https://api.github.com/user/emails", headers=headers, timeout=10.0)
            
            logger.info("GET /user/emails HTTP status: %s", emails_resp.status_code)
            logger.info("GET /user/emails X-OAuth-Scopes: '%s'", emails_resp.headers.get("X-OAuth-Scopes", ""))
            logger.info("GET /user/emails X-Accepted-OAuth-Scopes: '%s'", emails_resp.headers.get("X-Accepted-OAuth-Scopes", ""))
            
            if emails_resp.status_code != 200:
                logger.error(
                    "Failed to fetch GitHub user emails with status %s", emails_resp.status_code
                )
                raise GithubAuthError("Failed to retrieve user emails from GitHub.")
                
            emails = emails_resp.json()
            primary_email = None
            
            # Find primary and verified email
            for email_obj in emails:
                if email_obj.get("primary") and email_obj.get("verified"):
                    primary_email = email_obj.get("email")
                    break
            
            # Fallback to any verified email if no primary verified is found
            if not primary_email:
                for email_obj in emails:
                    if email_obj.get("verified"):
                        primary_email = email_obj.get("email")
                        break
                        
            if not primary_email:
                raise GithubAuthError("No verified email address found on your GitHub account.")
                
            return {
                "github_user_id": str(profile["id"]),
                "username": profile["login"],
                "full_name": profile.get("name") or profile["login"],
                "email": primary_email
            }

    async def verify_user_installation(self, access_token: str, installation_id: str) -> Optional[Dict[str, Any]]:
        """
        Verify that the given installation_id belongs to an installation accessible by the authenticated user.
        Returns the installation details if verified, else None.
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/installations", 
                headers=headers, 
                params={"per_page": 100},
                timeout=10.0
            )
            
            if resp.status_code != 200:
                logger.error(f"Failed to fetch user installations: {resp.text}")
                return None
                
            data = resp.json()
            installations = data.get("installations", [])
            
            for inst in installations:
                if str(inst.get("id")) == str(installation_id):
                    return inst
                    
            return None

    async def get_repository(
        self, access_token: str, owner: str, repo: str
    ) -> Dict[str, Any]:
        """
        Fetch repository information from GitHub using the authenticated user's token.

        Uses GET /repos/{owner}/{repo} which respects the user's access permissions.
        Raises GithubAuthError if the repository cannot be accessed.
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}",
                headers=headers,
                timeout=10.0,
            )

            if resp.status_code == 404:
                raise GithubAuthError(
                    f"Repository {owner}/{repo} not found or not accessible."
                )

            if resp.status_code == 403:
                raise GithubAuthError(
                    f"Access denied to repository {owner}/{repo}."
                )

            if resp.status_code != 200:
                logger.error(
                    "Failed to fetch GitHub repository %s/%s with status %s",
                    owner,
                    repo,
                    resp.status_code,
                )
                raise GithubAuthError(
                    f"Failed to retrieve repository {owner}/{repo} from GitHub."
                )

            return resp.json()

    async def get_branch_commit(
        self, access_token: str, owner: str, repo: str, branch: str
    ) -> str:
        """
        Fetch the current commit SHA for a specific branch from GitHub.

        Raises GithubAuthError if the branch is not found or accessible.
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/branches/{branch}",
                headers=headers,
                timeout=10.0,
            )

            if resp.status_code == 404:
                raise GithubAuthError(
                    f"Branch {branch} not found in repository {owner}/{repo}."
                )

            if resp.status_code != 200:
                logger.error(
                    "Failed to fetch GitHub branch %s for %s/%s with status %s",
                    branch,
                    owner,
                    repo,
                    resp.status_code,
                )
                raise GithubAuthError(
                    f"Failed to retrieve branch {branch} for {owner}/{repo} from GitHub."
                )

            data = resp.json()
            return data["commit"]["sha"]

    async def download_repository_snapshot(
        self, access_token: str, owner: str, repo: str, commit_sha: str
    ) -> RepositorySnapshot:
        """
        Download and securely extract a repository tarball for an exact commit SHA.
        Returns a RepositorySnapshot that handles its own cleanup.
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        temp_dir = Path(tempfile.mkdtemp(prefix="github_snapshot_"))
        tar_path = temp_dir / "archive.tar.gz"
        extracted_root = temp_dir / "extracted"
        extracted_root.mkdir(parents=True, exist_ok=True)

        try:
            async with httpx.AsyncClient() as client:
                url = f"https://api.github.com/repos/{owner}/{repo}/tarball/{commit_sha}"
                async with client.stream(
                    "GET", url, headers=headers, follow_redirects=True, timeout=30.0
                ) as resp:
                    if resp.status_code == 404:
                        raise GithubAuthError(
                            f"Commit {commit_sha} not found for {owner}/{repo}."
                        )
                    if resp.status_code != 200:
                        raise GithubAuthError(
                            f"Failed to download archive for {owner}/{repo} at {commit_sha} with status {resp.status_code}."
                        )

                    with open(tar_path, "wb") as f:
                        async for chunk in resp.aiter_bytes():
                            f.write(chunk)

            try:
                with tarfile.open(tar_path, "r:gz") as tar:
                    members = tar.getmembers()
                    if not members:
                        raise GithubArchiveError("Archive is empty.")

                    # Identify the common top-level directory wrapper
                    top_level_dirs = set()
                    for m in members:
                        parts = Path(m.name).parts
                        if parts:
                            top_level_dirs.add(parts[0])

                    if len(top_level_dirs) != 1:
                        raise GithubArchiveError(
                            "Archive does not have a single top-level directory wrapper."
                        )
                    wrapper_prefix = top_level_dirs.pop()

                    for member in members:
                        if member.name.startswith("/") or ".." in member.name:
                            raise GithubArchiveError(
                                f"Suspicious path in archive: {member.name}"
                            )

                        if member.issym() or member.islnk():
                            raise GithubArchiveError(
                                f"Symlinks are not allowed in MVP snapshot: {member.name}"
                            )

                        # Skip the wrapper directory itself
                        if member.name == wrapper_prefix or member.name == wrapper_prefix + "/":
                            continue

                        try:
                            rel_path = Path(member.name).relative_to(wrapper_prefix)
                        except ValueError:
                            raise GithubArchiveError(
                                f"Member path does not start with top-level wrapper: {member.name}"
                            )

                        normalized_path = os.path.normpath(str(rel_path))
                        if normalized_path.startswith("/") or normalized_path.startswith(".."):
                            raise GithubArchiveError(
                                f"Path traversal detected after normalization: {normalized_path}"
                            )

                        dest_path = (extracted_root / normalized_path).resolve()
                        if not dest_path.is_relative_to(extracted_root.resolve()):
                            raise GithubArchiveError(
                                f"Extraction path escapes root: {member.name}"
                            )

                        member.name = normalized_path

                        if not (member.isreg() or member.isdir()):
                            raise GithubArchiveError(
                                f"Unsupported file type in archive: {member.name}"
                            )

                        tar.extract(member, path=extracted_root)

            except tarfile.TarError as e:
                raise GithubArchiveError(
                    f"Failed to parse or extract tarball: {str(e)}"
                ) from e

        except Exception:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise

        finally:
            if tar_path.exists():
                tar_path.unlink()

        return RepositorySnapshot(path=temp_dir)


