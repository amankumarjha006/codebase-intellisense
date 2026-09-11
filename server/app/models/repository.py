from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.knowledge import (
        AnalysisResult,
        File,
        FileRelationship,
        SymbolRelationship,
    )
    from app.models.user import GithubInstallation, User, UserRepository


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    github_installation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("github_installations.id", ondelete="SET NULL"), index=True, nullable=True
    )
    github_repo_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    clone_url: Mapped[str] = mapped_column(Text, nullable=False)
    is_private: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    github_installation: Mapped[GithubInstallation | None] = relationship(
        back_populates="repositories"
    )
    user_accesses: Mapped[list[UserRepository]] = relationship(
        back_populates="repository", cascade="all, delete-orphan", passive_deletes=True
    )
    versions: Mapped[list[RepositoryVersion]] = relationship(
        back_populates="repository", cascade="all, delete-orphan", passive_deletes=True
    )
    index_jobs: Mapped[list[IndexJob]] = relationship(
        back_populates="repository", cascade="all, delete-orphan", passive_deletes=True
    )
    conversations: Mapped[list[Conversation]] = relationship(
        back_populates="repository", cascade="all, delete-orphan", passive_deletes=True
    )


class UserRepository(Base):
    __tablename__ = "user_repositories"
    __table_args__ = (
        UniqueConstraint("user_id", "repository_id", name="uq_user_repositories_user_repository"),
        Index("ix_user_repositories_repository_id", "repository_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    repository_id: Mapped[UUID] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="repository_accesses")
    repository: Mapped[Repository] = relationship(back_populates="user_accesses")


class RepositoryVersion(Base):
    __tablename__ = "repository_versions"
    __table_args__ = (
        CheckConstraint(
            "index_status IN ('PENDING', 'SUCCESS', 'FAILED')",
            name="ck_repository_versions_index_status",
        ),
        UniqueConstraint("repository_id", "commit_sha", name="uq_repository_versions_repository_commit"),
        Index("ix_repository_versions_repository_id", "repository_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    repository_id: Mapped[UUID] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    commit_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    branch: Mapped[str] = mapped_column(String(255), nullable=False)
    index_status: Mapped[str] = mapped_column(
        String(16), server_default=text("'PENDING'"), nullable=False
    )
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    repository: Mapped[Repository] = relationship(back_populates="versions")
    index_jobs: Mapped[list[IndexJob]] = relationship(
        back_populates="repository_version", cascade="all, delete-orphan", passive_deletes=True
    )
    files: Mapped[list[File]] = relationship(
        back_populates="repository_version", cascade="all, delete-orphan", passive_deletes=True
    )
    symbol_relationships: Mapped[list[SymbolRelationship]] = relationship(
        back_populates="repository_version", cascade="all, delete-orphan", passive_deletes=True
    )
    file_relationships: Mapped[list[FileRelationship]] = relationship(
        back_populates="repository_version", cascade="all, delete-orphan", passive_deletes=True
    )
    analysis_results: Mapped[list[AnalysisResult]] = relationship(
        back_populates="repository_version", cascade="all, delete-orphan", passive_deletes=True
    )
    conversations: Mapped[list[Conversation]] = relationship(back_populates="repository_version")


class IndexJob(Base):
    __tablename__ = "index_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING', 'READY', 'FAILED')",
            name="ck_index_jobs_status",
        ),
        Index(
            "uq_index_jobs_one_active_per_repository",
            "repository_id",
            unique=True,
            postgresql_where=text(
                "status IN ('QUEUED', 'FETCHING', 'INDEXING', 'ANALYZING')"
            ),
        ),
        Index("ix_index_jobs_repository_id_created_at", "repository_id", "created_at"),
        Index("ix_index_jobs_repository_version_id", "repository_version_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    repository_id: Mapped[UUID] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    repository_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("repository_versions.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), server_default=text("'QUEUED'"), nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    repository: Mapped[Repository] = relationship(back_populates="index_jobs")
    repository_version: Mapped[RepositoryVersion] = relationship(back_populates="index_jobs")
