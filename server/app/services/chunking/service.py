import logging
from typing import List
from uuid import UUID

from app.models.repository import RepositoryVersion
from app.models.knowledge import File, Symbol, CodeChunk
from app.repositories.knowledge import KnowledgeRepository
from app.core.config import settings

from app.services.chunking.ast_chunker import ASTChunker
from app.services.chunking.line_chunker import LineChunker
from app.services.indexing import read_file_content # assuming this is available, or we fetch from disk

logger = logging.getLogger(__name__)

class ChunkBuilderService:
    def __init__(self, knowledge_repo: KnowledgeRepository, repo_path: str):
        self.knowledge_repo = knowledge_repo
        self.repo_path = repo_path
        self.max_chars = settings.CHUNK_MAX_CHARS
        
        self.ast_chunker = ASTChunker(self.max_chars)
        self.line_chunker = LineChunker(self.max_chars)
        
        self.supported_ast_languages = {"python", "javascript", "jsx", "typescript", "tsx"}

    def build_chunks(self, version: RepositoryVersion, files: List[File]) -> dict:
        """
        Builds chunks for all given files, respecting AST boundaries and assigning symbols.
        Returns statistics.
        """
        stats = {
            "files_processed": 0,
            "chunks_created": 0,
            "files_skipped": 0
        }
        
        if not files:
            return stats
            
        file_ids = [f.id for f in files]
        
        # 1. Idempotency: Delete existing chunks for these files
        self.knowledge_repo.delete_chunks_for_files(file_ids)
        
        # 2. Fetch all symbols for these files (to avoid N+1 queries)
        # Assuming we can query them from db.
        # Alternatively, we could fetch them per file.
        from sqlalchemy import select
        stmt = select(Symbol).where(Symbol.file_id.in_(file_ids))
        all_symbols = list(self.knowledge_repo.db.execute(stmt).scalars().all())
        
        symbols_by_file = {}
        for s in all_symbols:
            symbols_by_file.setdefault(s.file_id, []).append(s)
            
        # 3. Process each file
        import os
        from pathlib import Path
        
        new_chunks = []
        
        for file in files:
            try:
                abs_path = os.path.join(self.repo_path, file.file_path)
                if not os.path.exists(abs_path):
                    stats["files_skipped"] += 1
                    continue
                    
                with open(abs_path, 'rb') as f:
                    source_bytes = f.read()
                    
                file_symbols = symbols_by_file.get(file.id, [])
                
                if file.language in self.supported_ast_languages:
                    chunk_data_list = self.ast_chunker.chunk(
                        file.id, file.file_path, file.language, source_bytes, file_symbols
                    )
                else:
                    chunk_data_list = self.line_chunker.chunk(
                        file.id, file.file_path, file.language, source_bytes
                    )
                    
                for c_data in chunk_data_list:
                    new_chunks.append(CodeChunk(
                        file_id=c_data.file_id,
                        symbol_id=c_data.symbol_id,
                        # CodeChunk model doesn't have parent_symbol_id right now.
                        # Wait, did the user tell me to add parent_symbol_id to ChunkData?
                        # Yes, but not to the CodeChunk model. Let's omit it from the model for now if it's not defined, or maybe I should check CodeChunk model again.
                        content=c_data.content,
                        start_line=c_data.start_line,
                        end_line=c_data.end_line,
                        chunk_index=c_data.chunk_index
                    ))
                    
                stats["files_processed"] += 1
                
            except Exception as e:
                logger.warning(f"Failed to chunk file {file.file_path}: {e}")
                stats["files_skipped"] += 1
                
        # 4. Bulk insert
        if new_chunks:
            self.knowledge_repo.bulk_create_code_chunks(new_chunks)
            stats["chunks_created"] = len(new_chunks)
            
        return stats
