from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.repository import Repository, UserRepository


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    github_accounts: Mapped[list[GithubAccount]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    repository_accesses: Mapped[list[UserRepository]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    conversations: Mapped[list[Conversation]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class GithubAccount(Base):
    __tablename__ = "github_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "github_user_id", name="uq_github_accounts_user_github_user"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    github_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="github_accounts")
    installations: Mapped[list[GithubInstallation]] = relationship(
        back_populates="github_account", cascade="all, delete-orphan", passive_deletes=True
    )


class GithubInstallation(Base):
    __tablename__ = "github_installations"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    github_account_id: Mapped[UUID] = mapped_column(
        ForeignKey("github_accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    installation_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    github_account: Mapped[GithubAccount] = relationship(back_populates="installations")
    repositories: Mapped[list[Repository]] = relationship(
        back_populates="github_installation", passive_deletes=True
    )
