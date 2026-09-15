import logging
from typing import Any, Dict
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.repository import Repository, RepositoryVersion, IndexJob
from app.repositories.repository import RepositoryRepository
from app.services.github import GithubService, GithubAuthError

logger = logging.getLogger(__name__)


class RepositoryServiceError(Exception):
    """Base exception for repository service operations."""
    pass


class InvalidRepositoryUrlError(RepositoryServiceError):
    """Raised when the submitted URL is not a valid GitHub repository URL."""
    pass


class RepositoryNotAccessibleError(RepositoryServiceError):
    """Raised when the repository cannot be accessed via the user's GitHub credentials."""
    pass


class RepositoryActiveJobError(RepositoryServiceError):
    """Raised when attempting to queue analysis but an active job already exists."""
    pass


def parse_github_url(url: str) -> tuple[str, str]:
    """
    Parse a GitHub repository URL and return (owner, repo).

    Accepts:
        https://github.com/owner/repo
        https://github.com/owner/repo/
        https://github.com/owner/repo.git

    Rejects non-GitHub hosts, missing owner/repo, and deep paths
    (e.g. /issues, /tree/main, /pull/123).
    """
    parsed = urlparse(url.strip())

    if parsed.scheme != "https":
        raise InvalidRepositoryUrlError(f"Invalid URL scheme: {parsed.scheme!r}")

    if parsed.hostname != "github.com":
        raise InvalidRepositoryUrlError(
            f"Only GitHub repositories are supported. Got host: {parsed.hostname!r}"
        )

    # Strip leading/trailing slashes, then split
    path = parsed.path.strip("/")

    # Remove trailing .git suffix
    if path.endswith(".git"):
        path = path[:-4]

    parts = path.split("/")

    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise InvalidRepositoryUrlError(
            "URL must be in the format https://github.com/{owner}/{repo}"
        )

    return parts[0], parts[1]


class RepositoryService:
    def __init__(self, db: Session, github_service: GithubService):
        self.db = db
        self.github = github_service
        self.repository_repo = RepositoryRepository(db)

    async def connect_repository(
        self,
        *,
        user_id: UUID,
        url: str,
        github_access_token: str,
    ) -> Repository:
        """
        Connect a GitHub repository for the authenticated user.

        Flow:
        1. Parse and validate the GitHub repository URL.
        2. Fetch canonical repository info from GitHub using the user's token.
        3. Find or create the local Repository record.
        4. Ensure the user has access (UserRepository).
        5. Commit the transaction.
        6. Return the Repository.
        """
        # 1. Parse URL
        owner, name = parse_github_url(url)

        # 2. Resolve from GitHub
        try:
            github_repo = await self.github.get_repository(
                access_token=github_access_token,
                owner=owner,
                repo=name,
            )
        except GithubAuthError as e:
            raise RepositoryNotAccessibleError(
                f"Cannot access repository {owner}/{name} on GitHub."
            ) from e

        github_repo_id = str(github_repo["id"])
        canonical_owner = github_repo["owner"]["login"]
        canonical_name = github_repo["name"]
        clone_url = github_repo["clone_url"]
        is_private = github_repo["private"]

        try:
            # 3. Find or create local repository
            repository = self.repository_repo.get_by_github_repo_id(github_repo_id)

            if repository is None:
                repository = self.repository_repo.create(
                    github_repo_id=github_repo_id,
                    owner=canonical_owner,
                    name=canonical_name,
                    clone_url=clone_url,
                    is_private=is_private,
                )

            # 4. Ensure user access
            if not self.repository_repo.user_has_access(
                user_id=user_id,
                repository_id=repository.id,
            ):
                self.repository_repo.grant_user_access(
                    user_id=user_id,
                    repository_id=repository.id,
                )

            # 5. Commit transaction
            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return repository

    def queue_analysis(
        self,
        repository: Repository,
        branch: str,
        commit_sha: str,
    ) -> tuple[RepositoryVersion, IndexJob]:
        """
        Queue a new analysis job for a repository.
        Creates a RepositoryVersion (if it doesn't exist) and an IndexJob.
        Raises RepositoryActiveJobError if an active job already exists.
        """
        try:
            # 1. Check for active job
            active_job = self.repository_repo.get_active_job(repository.id)
            if active_job:
                raise RepositoryActiveJobError("Repository analysis is already in progress.")

            # 2. Find or create RepositoryVersion
            version = self.repository_repo.get_version_by_commit(repository.id, commit_sha)
            if not version:
                version = self.repository_repo.create_version(
                    repository_id=repository.id,
                    commit_sha=commit_sha,
                    branch=branch,
                    index_status="PENDING",
                )

            # 3. Create IndexJob
            job = self.repository_repo.create_index_job(
                repository_id=repository.id,
                repository_version_id=version.id,
                status="QUEUED",
            )

            # 4. Commit transaction
            self.db.commit()

            return version, job

        except Exception:
            self.db.rollback()
            raise

