from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from app.models.repository import Repository, UserRepository, RepositoryVersion, IndexJob

class RepositoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_github_repo_id(self, github_repo_id: str) -> Repository | None:
        stmt = select(Repository).where(Repository.github_repo_id == github_repo_id)
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
    ) -> tuple[list[Repository], int]:
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
        stmt = base_stmt.order_by(Repository.created_at.desc(), Repository.id.desc()).offset(offset).limit(limit)
        
        items = self.db.execute(stmt).scalars().all()
        return list(items), total

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
