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

    def get_files_for_version(self, repository_version_id: UUID) -> list[File]:
        """Get files for a given repository version, ordered deterministically by path."""
        return list(
            self.db.execute(
                select(File)
                .where(File.repository_version_id == repository_version_id)
                .order_by(File.file_path.asc(), File.id.asc())
            ).scalars().all()
        )

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

    def delete_file_relationships_for_version(self, repository_version_id: UUID) -> int:
        stmt = delete(FileRelationship).where(FileRelationship.repository_version_id == repository_version_id)
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount

    def generate_file_relationships(self, repository_version_id: UUID) -> None:
        """
        Minimum relationship generation based on import symbols matching local file names.
        """
        self.delete_file_relationships_for_version(repository_version_id)

        # Fetch files
        stmt_files = select(File).where(File.repository_version_id == repository_version_id)
        files = self.db.execute(stmt_files).scalars().all()
        
        file_map = {}
        for f in files:
            base_name = f.file_name.rsplit('.', 1)[0]
            file_map[base_name] = f.id

        # Fetch import symbols
        stmt_symbols = select(Symbol).join(File).where(
            File.repository_version_id == repository_version_id,
            Symbol.symbol_type == "import"
        )
        imports = self.db.execute(stmt_symbols).scalars().all()

        rels = []
        seen = set()
        for imp in imports:
            target_file_id = file_map.get(imp.name)
            if target_file_id and target_file_id != imp.file_id:
                key = (imp.file_id, target_file_id)
                if key not in seen:
                    rels.append(
                        FileRelationship(
                            repository_version_id=repository_version_id,
                            source_file_id=imp.file_id,
                            target_file_id=target_file_id,
                            relationship_type="IMPORTS"
                        )
                    )
                    seen.add(key)
        
        if rels:
            self.db.add_all(rels)
            self.db.flush()

    def get_architecture_data(self, repository_version_id: UUID) -> dict[str, Any]:
        """
        Generate deterministic architecture payload.
        """
        stmt_files = select(File).where(File.repository_version_id == repository_version_id).order_by(File.file_path)
        files = self.db.execute(stmt_files).scalars().all()

        stmt_symbols = select(Symbol).join(File).where(
            File.repository_version_id == repository_version_id
        ).order_by(Symbol.file_id, Symbol.name)
        symbols = self.db.execute(stmt_symbols).scalars().all()

        stmt_frels = select(FileRelationship).where(
            FileRelationship.repository_version_id == repository_version_id
        ).order_by(FileRelationship.source_file_id, FileRelationship.target_file_id)
        frels = self.db.execute(stmt_frels).scalars().all()

        stmt_srels = select(SymbolRelationship).where(
            SymbolRelationship.repository_version_id == repository_version_id
        ).order_by(SymbolRelationship.source_symbol_id, SymbolRelationship.target_symbol_id)
        srels = self.db.execute(stmt_srels).scalars().all()

        nodes = []
        relationships = []

        # 1. Add files
        for f in files:
            nodes.append({
                "id": f"file_{f.id}",
                "type": "file",
                "name": f.file_name,
                "path": f.file_path,
                "language": f.language
            })

        # 2. Add symbols
        for s in symbols:
            nodes.append({
                "id": f"symbol_{s.id}",
                "type": "symbol",
                "symbol_type": s.symbol_type,
                "name": s.name,
                "file_id": f"file_{s.file_id}"
            })
            relationships.append({
                "source": f"file_{s.file_id}",
                "target": f"symbol_{s.id}",
                "type": "CONTAINS"
            })

        # 3. Add file relationships
        for fr in frels:
            relationships.append({
                "source": f"file_{fr.source_file_id}",
                "target": f"file_{fr.target_file_id}",
                "type": fr.relationship_type
            })

        # 4. Add symbol relationships
        for sr in srels:
            relationships.append({
                "source": f"symbol_{sr.source_symbol_id}",
                "target": f"symbol_{sr.target_symbol_id}",
                "type": sr.relationship_type
            })

        return {
            "nodes": nodes,
            "relationships": relationships
        }

    def search_code_chunks(self, repository_version_id: UUID, query: str, limit: int = 20) -> list[tuple[CodeChunk, File, float]]:
        """
        Perform a lexical search on CodeChunk contents isolated to a specific repository version.
        Combines exact substring matching (ILIKE) with PostgreSQL Full-Text Search.
        """
        escaped_query = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        
        tsquery = func.websearch_to_tsquery('english', query)
        tsvector = func.to_tsvector('english', CodeChunk.content)
        
        exact_match = CodeChunk.content.ilike(f"%{escaped_query}%", escape="\\")
        fts_rank = func.ts_rank_cd(tsvector, tsquery)
        
        score = (case((exact_match, 1.0), else_=0.0) + fts_rank).label("score")
        
        stmt = (
            select(CodeChunk, File, score)
            .join(File)
            .where(
                File.repository_version_id == repository_version_id,
                or_(exact_match, tsvector.op('@@')(tsquery))
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
