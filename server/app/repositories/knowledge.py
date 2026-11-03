from sqlalchemy.orm import Session
from sqlalchemy import delete, select, func, case, or_
from uuid import UUID
from typing import Any
from app.models.knowledge import File, Symbol, CodeChunk, AnalysisResult, FileRelationship, SymbolRelationship, Embedding

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
        Delete all symbols associated with the given file IDs in safe batches.
        """
        if not file_ids:
            return
        for i in range(0, len(file_ids), 1000):
            batch = file_ids[i : i + 1000]
            stmt = delete(Symbol).where(Symbol.file_id.in_(batch))
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
        Delete all code chunks associated with the given file IDs in safe batches.
        """
        if not file_ids:
            return
        for i in range(0, len(file_ids), 1000):
            batch = file_ids[i : i + 1000]
            stmt = delete(CodeChunk).where(CodeChunk.file_id.in_(batch))
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

    def count_lines_for_version(self, repository_version_id: UUID) -> int:
        """Count total lines of code across files for a given repository version."""
        sub = (
            select(func.max(CodeChunk.end_line).label("max_line"))
            .join(File, File.id == CodeChunk.file_id)
            .where(File.repository_version_id == repository_version_id)
            .group_by(CodeChunk.file_id)
            .subquery()
        )
        result = self.db.execute(select(func.coalesce(func.sum(sub.c.max_line), 0))).scalar_one()
        return int(result)

    def get_files_for_version(
        self,
        repository_version_id: UUID,
        skip: int = 0,
        limit: int | None = None,
        q: str | None = None,
    ) -> list[File]:
        """Get files for a given repository version, ordered deterministically by path."""
        stmt = (
            select(File)
            .where(File.repository_version_id == repository_version_id)
        )
        if q:
            clean_q = q.replace("%", "\\%").replace("_", "\\_")
            stmt = stmt.where(File.file_path.ilike(f"%{clean_q}%"))
        stmt = stmt.order_by(File.file_path.asc(), File.id.asc())
        if skip > 0:
            stmt = stmt.offset(skip)
        if limit is not None:
            stmt = stmt.limit(limit)

        return list(self.db.execute(stmt).scalars().all())

    def count_files_for_version(
        self,
        repository_version_id: UUID,
        q: str | None = None,
    ) -> int:
        """Count files for a given repository version, optionally filtered by path."""
        stmt = (
            select(func.count(File.id))
            .where(File.repository_version_id == repository_version_id)
        )
        if q:
            clean_q = q.replace("%", "\\%").replace("_", "\\_")
            stmt = stmt.where(File.file_path.ilike(f"%{clean_q}%"))
        return self.db.execute(stmt).scalar_one()


    def get_file_content_for_version(self, file_id: UUID, repository_version_id: UUID) -> tuple[File, str] | None:
        """
        Get a specific file and reconstruct its content from chunks, 
        ensuring it belongs to the exact repository_version_id.
        """
        file = self.db.execute(
            select(File).where(
                File.id == file_id, 
                File.repository_version_id == repository_version_id
            )
        ).scalar_one_or_none()
        
        if not file:
            return None
            
        chunks = self.db.execute(
            select(CodeChunk)
            .where(CodeChunk.file_id == file_id)
            .order_by(CodeChunk.chunk_index.asc())
        ).scalars().all()
        
        content = "".join(chunk.content for chunk in chunks)
        return file, content

    def get_language_stats_for_version(self, repository_version_id: UUID) -> list[tuple[str, int]]:
        """Get language distribution for a given repository version."""
        return list(self.db.execute(
            select(File.language, func.count(File.id))
            .where(File.repository_version_id == repository_version_id)
            .group_by(File.language)
        ).all())

    def get_analysis_result(self, repository_version_id: UUID, analysis_type: str) -> AnalysisResult | None:
        """Get a specific analysis result for a repository version."""
        return self.db.execute(
            select(AnalysisResult).where(
                AnalysisResult.repository_version_id == repository_version_id,
                AnalysisResult.analysis_type == analysis_type
            )
        ).scalar_one_or_none()

    def search_code_chunks(self, repository_version_id: UUID, query: str, limit: int = 20) -> list[tuple[CodeChunk, File, float]]:
        """
        Perform a lexical search on CodeChunk contents and file paths isolated to a specific repository version.
        Combines exact substring matching (ILIKE) with PostgreSQL Full-Text Search across content and normalized file paths.
        """
        escaped_query = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        
        clean_path_expr = func.replace(func.replace(func.replace(File.file_path, '/', ' '), '_', ' '), '-', ' ')
        combined_text = func.concat(clean_path_expr, ' ', CodeChunk.content)
        
        tsquery = func.websearch_to_tsquery('english', query)
        tsvector = func.to_tsvector('english', combined_text)
        
        exact_match = combined_text.ilike(f"%{escaped_query}%", escape="\\")
        path_match = clean_path_expr.ilike(f"%{escaped_query}%", escape="\\")
        fts_rank = func.ts_rank_cd(tsvector, tsquery)
        
        score = (case((exact_match, 1.0), else_=0.0) + case((path_match, 0.5), else_=0.0) + fts_rank).label("score")
        
        stmt = (
            select(CodeChunk, File, score)
            .join(File)
            .where(
                File.repository_version_id == repository_version_id,
                or_(exact_match, path_match, tsvector.op('@@')(tsquery))
            )
            .order_by(
                score.desc(),
                File.file_path.asc(),
                CodeChunk.chunk_index.asc(),
                CodeChunk.id.asc()
            )
            .limit(limit)
        )
        
        results = self.db.execute(stmt).all()
        return list(results)

    def search_semantic_chunks(self, repository_version_id: UUID, query_vector: list[float], limit: int = 20) -> list[tuple[CodeChunk, File, float]]:
        """
        Perform a semantic vector search isolated to a specific repository version.
        Uses cosine distance via pgvector.
        """
        distance = Embedding.vector.cosine_distance(query_vector).label("distance")
        
        stmt = (
            select(CodeChunk, File, distance)
            .join(Embedding, Embedding.code_chunk_id == CodeChunk.id)
            .join(File, CodeChunk.file_id == File.id)
            .where(File.repository_version_id == repository_version_id)
            .order_by(
                distance.asc(),
                File.file_path.asc(),
                CodeChunk.chunk_index.asc(),
                CodeChunk.id.asc()
            )
            .limit(limit)
        )
        
        results = self.db.execute(stmt).all()
        return list(results)
