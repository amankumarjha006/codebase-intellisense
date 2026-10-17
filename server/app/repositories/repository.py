from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, func, or_, true
from sqlalchemy.orm import Session, aliased

from app.models.repository import Repository, UserRepository, RepositoryVersion, IndexJob


@dataclass(frozen=True, slots=True)
class RepositoryListRow:
    """Immutable projection returned by list_for_user."""
    id: UUID
    owner: str
    name: str
    is_private: bool
    created_at: datetime
    latest_job_status: str | None
    latest_job_failure_code: str | None
    active_version_short_sha: str | None
    last_indexed_at: datetime | None

class RepositoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_github_repo_id(self, github_repo_id: str) -> Repository | None:
        stmt = select(Repository).where(Repository.github_repo_id == github_repo_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id(self, repository_id: UUID) -> Repository | None:
        stmt = select(Repository).where(Repository.id == repository_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(
        self,
        *,
        github_repo_id: str,
        owner: str,
        name: str,
        clone_url: str,
        is_private: bool,
        github_installation_id: UUID | None = None,
    ) -> Repository:
        repo = Repository(
            github_repo_id=github_repo_id,
            owner=owner,
            name=name,
            clone_url=clone_url,
            is_private=is_private,
            github_installation_id=github_installation_id,
        )
        self.db.add(repo)
        self.db.flush()
        return repo

    def grant_user_access(
        self,
        *,
        user_id: UUID,
        repository_id: UUID,
    ) -> UserRepository:
        user_repo = UserRepository(
            user_id=user_id,
            repository_id=repository_id,
        )
        self.db.add(user_repo)
        self.db.flush()
        return user_repo

    def user_has_access(
        self,
        *,
        user_id: UUID,
        repository_id: UUID,
    ) -> bool:
        stmt = select(UserRepository).where(
            UserRepository.user_id == user_id,
            UserRepository.repository_id == repository_id
        )
        return self.db.execute(stmt).scalar_one_or_none() is not None

    def get_for_user(
        self,
        *,
        user_id: UUID,
        repository_id: UUID,
    ) -> Repository | None:
        stmt = (
            select(Repository)
            .join(UserRepository)
            .where(
                UserRepository.user_id == user_id,
                Repository.id == repository_id
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_user(
        self,
        *,
        user_id: UUID,
        page: int,
        limit: int,
        search: str | None = None,
    ) -> tuple[list[RepositoryListRow], int]:
        base_stmt = select(Repository).join(UserRepository).where(UserRepository.user_id == user_id)
        
        if search:
            search_term = f"%{search}%"
            base_stmt = base_stmt.where(
                or_(
                    Repository.name.ilike(search_term),
                    Repository.owner.ilike(search_term)
                )
            )

        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = self.db.execute(count_stmt).scalar_one()

        offset = (page - 1) * limit
        paginated_stmt = (
            base_stmt
            .order_by(Repository.created_at.desc(), Repository.id.desc())
            .offset(offset)
            .limit(limit)
        )

        paginated_sq = paginated_stmt.subquery("paginated_repos")
        AR = aliased(Repository, paginated_sq)

        latest_job_sq = (
            select(
                IndexJob.status.label("latest_job_status"),
                IndexJob.failure_code.label("latest_job_failure_code"),
            )
            .where(IndexJob.repository_id == AR.id)
            .order_by(IndexJob.created_at.desc(), IndexJob.id.desc())
            .limit(1)
            .lateral("latest_job")
        )

        active_version_sq = (
            select(
                func.substr(RepositoryVersion.commit_sha, 1, 7).label("active_version_short_sha"),
                RepositoryVersion.indexed_at.label("last_indexed_at"),
            )
            .where(
                RepositoryVersion.repository_id == AR.id,
                RepositoryVersion.index_status == "SUCCESS",
            )
            .order_by(
                RepositoryVersion.indexed_at.desc().nulls_last(),
                RepositoryVersion.id.desc(),
            )
            .limit(1)
            .lateral("active_version")
        )

        stmt = (
            select(
                AR.id,
                AR.owner,
                AR.name,
                AR.is_private,
                AR.created_at,
                latest_job_sq.c.latest_job_status,
                latest_job_sq.c.latest_job_failure_code,
                active_version_sq.c.active_version_short_sha,
                active_version_sq.c.last_indexed_at,
            )
            .select_from(AR)
            .outerjoin(latest_job_sq, true())
            .outerjoin(active_version_sq, true())
            .order_by(AR.created_at.desc(), AR.id.desc())
        )

        rows = self.db.execute(stmt).all()

        items = [
            RepositoryListRow(
                id=r.id,
                owner=r.owner,
                name=r.name,
                is_private=r.is_private,
                created_at=r.created_at,
                latest_job_status=r.latest_job_status,
                latest_job_failure_code=r.latest_job_failure_code,
                active_version_short_sha=r.active_version_short_sha,
                last_indexed_at=r.last_indexed_at,
            )
            for r in rows
        ]
        return items, total

    def create_version(
        self,
        *,
        repository_id: UUID,
        commit_sha: str,
        branch: str,
        index_status: str = "PENDING",
    ) -> RepositoryVersion:
        version = RepositoryVersion(
            repository_id=repository_id,
            commit_sha=commit_sha,
            branch=branch,
            index_status=index_status,
        )
        self.db.add(version)
        self.db.flush()
        return version

    def get_latest_version(
        self,
        repository_id: UUID,
    ) -> RepositoryVersion | None:
        stmt = (
            select(RepositoryVersion)
            .where(RepositoryVersion.repository_id == repository_id)
            .order_by(
                RepositoryVersion.indexed_at.desc().nulls_last(),
                RepositoryVersion.id.desc(),
            )
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_active_version(
        self,
        repository_id: UUID,
    ) -> RepositoryVersion | None:
        stmt = (
            select(RepositoryVersion)
            .where(
                RepositoryVersion.repository_id == repository_id,
                RepositoryVersion.index_status == "SUCCESS"
            )
            .order_by(
                RepositoryVersion.indexed_at.desc().nulls_last(),
                RepositoryVersion.id.desc(),
            )
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_versions_for_repository(
        self,
        repository_id: UUID,
    ) -> list[RepositoryVersion]:
        stmt = (
            select(RepositoryVersion)
            .where(RepositoryVersion.repository_id == repository_id)
            .order_by(
                RepositoryVersion.indexed_at.desc().nulls_last(),
                RepositoryVersion.id.desc(),
            )
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_version_by_commit(
        self,
        repository_id: UUID,
        commit_sha: str,
    ) -> RepositoryVersion | None:
        stmt = select(RepositoryVersion).where(
            RepositoryVersion.repository_id == repository_id,
            RepositoryVersion.commit_sha == commit_sha,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_version_by_id(
        self,
        version_id: UUID,
    ) -> RepositoryVersion | None:
        stmt = select(RepositoryVersion).where(
            RepositoryVersion.id == version_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def create_index_job(
        self,
        *,
        repository_id: UUID,
        repository_version_id: UUID,
        status: str = "QUEUED",
    ) -> IndexJob:
        job = IndexJob(
            repository_id=repository_id,
            repository_version_id=repository_version_id,
            status=status,
        )
        self.db.add(job)
        self.db.flush()
        return job

    def get_active_job(
        self,
        repository_id: UUID,
    ) -> IndexJob | None:
        stmt = (
            select(IndexJob)
            .where(
                IndexJob.repository_id == repository_id,
                IndexJob.status.in_(["QUEUED", "FETCHING", "INDEXING", "ANALYZING"])
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_job_by_id(
        self,
        job_id: UUID,
    ) -> IndexJob | None:
        stmt = select(IndexJob).where(IndexJob.id == job_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_jobs_for_repository(
        self,
        repository_id: UUID,
    ) -> list[IndexJob]:
        stmt = (
            select(IndexJob)
            .where(IndexJob.repository_id == repository_id)
            .order_by(IndexJob.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())
