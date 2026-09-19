from sqlalchemy.orm import Session
from sqlalchemy import delete, select, func
from uuid import UUID
from app.models.knowledge import File, Symbol, CodeChunk, AnalysisResult

class KnowledgeRepository:
    def __init__(self, db: Session):
        self.db = db

    def bulk_create_files(self, files: list[File]) -> list[File]:
        """
        Efficiently persist multiple File records within a transaction.
        The caller is responsible for commit/rollback.
        """
        self.db.add_all(files)
        self.db.flush()
        return files

    def delete_symbols_for_files(self, file_ids: list[UUID]) -> None:
        """
        Delete all symbols associated with the given file IDs.
        """
        if not file_ids:
            return
        stmt = delete(Symbol).where(Symbol.file_id.in_(file_ids))
        self.db.execute(stmt)
        self.db.flush()

    def bulk_create_symbols(self, symbols: list[Symbol]) -> list[Symbol]:
        """
        Efficiently persist multiple Symbol records.
        """
        if symbols:
            self.db.add_all(symbols)
            self.db.flush()
        return symbols

    def delete_chunks_for_files(self, file_ids: list[UUID]) -> None:
        """
        Delete all code chunks associated with the given file IDs.
        """
        if not file_ids:
            return
        stmt = delete(CodeChunk).where(CodeChunk.file_id.in_(file_ids))
        self.db.execute(stmt)
        self.db.flush()

    def bulk_create_code_chunks(self, chunks: list[CodeChunk]) -> list[CodeChunk]:
        """
        Efficiently persist multiple CodeChunk records.
        """
        if chunks:
            self.db.add_all(chunks)
            self.db.flush()
        return chunks

    def bulk_create_embeddings(self, embeddings: list) -> list:
        """
        Efficiently persist multiple Embedding records.
        """
        if embeddings:
            self.db.add_all(embeddings)
            self.db.flush()
        return embeddings

    def delete_files_for_version(self, repository_version_id: UUID) -> int:
        """
        Delete all files (and cascade to symbols, chunks, embeddings)
        for a given repository version.
        Returns the number of files deleted.
        """
        stmt = delete(File).where(File.repository_version_id == repository_version_id)
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount

    def delete_analysis_results_for_version(self, repository_version_id: UUID) -> int:
        """
        Delete all analysis results for a given repository version.
        Returns the number of results deleted.
        """
        stmt = delete(AnalysisResult).where(
            AnalysisResult.repository_version_id == repository_version_id
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount

    def count_files_for_version(self, repository_version_id: UUID) -> int:
        """Count files for a given repository version."""
        return self.db.execute(
            select(func.count(File.id)).where(File.repository_version_id == repository_version_id)
        ).scalar_one()

    def count_symbols_for_version(self, repository_version_id: UUID) -> int:
        """Count symbols for a given repository version."""
        return self.db.execute(
            select(func.count(Symbol.id))
            .join(File)
            .where(File.repository_version_id == repository_version_id)
        ).scalar_one()

    def count_chunks_for_version(self, repository_version_id: UUID) -> int:
        """Count code chunks for a given repository version."""
        return self.db.execute(
            select(func.count(CodeChunk.id))
            .join(File)
            .where(File.repository_version_id == repository_version_id)
        ).scalar_one()

    def get_language_stats_for_version(self, repository_version_id: UUID) -> list[tuple[str, int]]:
        """Get language distribution for a given repository version."""
        return list(self.db.execute(
            select(File.language, func.count(File.id))
            .where(File.repository_version_id == repository_version_id)
            .group_by(File.language)
        ).all())

