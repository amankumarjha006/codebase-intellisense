from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.conversation import Citation
    from app.models.repository import RepositoryVersion


class File(Base):
    __tablename__ = "files"
    __table_args__ = (
        UniqueConstraint("repository_version_id", "file_path", name="uq_files_version_path"),
        Index("ix_files_repository_version_id", "repository_version_id"),
        Index("ix_files_file_path", "file_path"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    repository_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("repository_versions.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    language: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    hash: Mapped[str] = mapped_column(String(128), nullable=False)

    repository_version: Mapped[RepositoryVersion] = relationship(back_populates="files")
    symbols: Mapped[list[Symbol]] = relationship(
        back_populates="file", cascade="all, delete-orphan", passive_deletes=True
    )
    code_chunks: Mapped[list[CodeChunk]] = relationship(
        back_populates="file", cascade="all, delete-orphan", passive_deletes=True
    )
    source_relationships: Mapped[list[FileRelationship]] = relationship(
        back_populates="source_file",
        foreign_keys="FileRelationship.source_file_id",
        passive_deletes=True,
    )
    target_relationships: Mapped[list[FileRelationship]] = relationship(
        back_populates="target_file",
        foreign_keys="FileRelationship.target_file_id",
        passive_deletes=True,
    )


class Symbol(Base):
    __tablename__ = "symbols"
    __table_args__ = (
        Index("ix_symbols_file_id_name", "file_id", "name"),
        Index("ix_symbols_qualified_name", "qualified_name"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    file_id: Mapped[UUID] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    qualified_name: Mapped[str] = mapped_column(String(1024), nullable=False)
    symbol_type: Mapped[str] = mapped_column(String(64), nullable=False)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)

    file: Mapped[File] = relationship(back_populates="symbols")
    code_chunks: Mapped[list[CodeChunk]] = relationship(back_populates="symbol")
    source_relationships: Mapped[list[SymbolRelationship]] = relationship(
        back_populates="source_symbol",
        foreign_keys="SymbolRelationship.source_symbol_id",
        passive_deletes=True,
    )
    target_relationships: Mapped[list[SymbolRelationship]] = relationship(
        back_populates="target_symbol",
        foreign_keys="SymbolRelationship.target_symbol_id",
        passive_deletes=True,
    )


class CodeChunk(Base):
    __tablename__ = "code_chunks"
    __table_args__ = (
        Index("ix_code_chunks_file_id_chunk_index", "file_id", "chunk_index"),
        Index("ix_code_chunks_symbol_id", "symbol_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    file_id: Mapped[UUID] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    symbol_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("symbols.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)

    file: Mapped[File] = relationship(back_populates="code_chunks")
    symbol: Mapped[Symbol | None] = relationship(back_populates="code_chunks")
    embeddings: Mapped[list[Embedding]] = relationship(
        back_populates="code_chunk", cascade="all, delete-orphan", passive_deletes=True
    )
    citations: Mapped[list[Citation]] = relationship(
        back_populates="code_chunk", passive_deletes=True
    )


class Embedding(Base):
    __tablename__ = "embeddings"
    __table_args__ = (
        UniqueConstraint("code_chunk_id", "model_name", name="uq_embeddings_chunk_model"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    code_chunk_id: Mapped[UUID] = mapped_column(
        ForeignKey("code_chunks.id", ondelete="CASCADE"), nullable=False
    )
    vector: Mapped[Any] = mapped_column(Vector(), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)

    code_chunk: Mapped[CodeChunk] = relationship(back_populates="embeddings")


class SymbolRelationship(Base):
    __tablename__ = "symbol_relationships"
    __table_args__ = (
        CheckConstraint(
            "relationship_type IN ('CALLS', 'REFERENCES', 'INHERITS', 'IMPLEMENTS')",
            name="ck_symbol_relationships_type",
        ),
        Index("ix_symbol_relationships_repository_version_id", "repository_version_id"),
        Index("ix_symbol_relationships_source_symbol_id", "source_symbol_id"),
        Index("ix_symbol_relationships_target_symbol_id", "target_symbol_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    repository_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("repository_versions.id", ondelete="CASCADE"), nullable=False
    )
    source_symbol_id: Mapped[UUID] = mapped_column(
        ForeignKey("symbols.id", ondelete="CASCADE"), nullable=False
    )
    target_symbol_id: Mapped[UUID] = mapped_column(
        ForeignKey("symbols.id", ondelete="CASCADE"), nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(32), nullable=False)

    repository_version: Mapped[RepositoryVersion] = relationship(
        back_populates="symbol_relationships"
    )
    source_symbol: Mapped[Symbol] = relationship(
        back_populates="source_relationships", foreign_keys=[source_symbol_id]
    )
    target_symbol: Mapped[Symbol] = relationship(
        back_populates="target_relationships", foreign_keys=[target_symbol_id]
    )


class FileRelationship(Base):
    __tablename__ = "file_relationships"
    __table_args__ = (
        CheckConstraint(
            "relationship_type IN ('IMPORTS', 'DEPENDS_ON')",
            name="ck_file_relationships_type",
        ),
        Index("ix_file_relationships_repository_version_id", "repository_version_id"),
        Index("ix_file_relationships_source_file_id", "source_file_id"),
        Index("ix_file_relationships_target_file_id", "target_file_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    repository_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("repository_versions.id", ondelete="CASCADE"), nullable=False
    )
    source_file_id: Mapped[UUID] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    target_file_id: Mapped[UUID] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(32), nullable=False)

    repository_version: Mapped[RepositoryVersion] = relationship(
        back_populates="file_relationships"
    )
    source_file: Mapped[File] = relationship(
        back_populates="source_relationships", foreign_keys=[source_file_id]
    )
    target_file: Mapped[File] = relationship(
        back_populates="target_relationships", foreign_keys=[target_file_id]
    )


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    __table_args__ = (
        CheckConstraint(
            "analysis_type IN ('TECH_STACK', 'ARCHITECTURE', 'STATISTICS', 'OVERVIEW')",
            name="ck_analysis_results_type",
        ),
        UniqueConstraint(
            "repository_version_id", "analysis_type", name="uq_analysis_results_version_type"
        ),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    repository_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("repository_versions.id", ondelete="CASCADE"), nullable=False
    )
    analysis_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    repository_version: Mapped[RepositoryVersion] = relationship(
        back_populates="analysis_results"
    )
