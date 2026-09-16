import logging
from uuid import UUID
from app.models.repository import RepositoryVersion
from app.models.knowledge import File
from app.repositories.knowledge import KnowledgeRepository
from .registry import get_extractor
import os

logger = logging.getLogger(__name__)

class SymbolExtractorService:
    def __init__(self, knowledge_repo: KnowledgeRepository, snapshot_root: str):
        self.knowledge_repo = knowledge_repo
        self.snapshot_root = snapshot_root

    def extract_symbols(self, repository_version: RepositoryVersion, files: list[File]) -> dict:
        stats = {
            "files_processed": 0,
            "files_skipped": 0,
            "files_with_symbols": 0,
            "symbols_extracted": 0,
            "files_skipped_unsupported_language": 0,
            "files_skipped_malformed": 0
        }
        
        if not files:
            return stats
            
        file_ids = [f.id for f in files]
        
        # 1. Delete existing symbols for exactly these files
        try:
            self.knowledge_repo.delete_symbols_for_files(file_ids)
        except Exception as e:
            logger.error(f"Failed to delete existing symbols: {e}")
            raise
            
        new_symbols = []
        
        # 2. Process each file
        for file in sorted(files, key=lambda f: f.file_path):
            extractor = get_extractor(file.language)
            if not extractor:
                stats["files_skipped_unsupported_language"] += 1
                stats["files_skipped"] += 1
                continue
                
            abs_path = os.path.join(self.snapshot_root, file.file_path)
            try:
                with open(abs_path, "rb") as f:
                    source_code = f.read()
            except Exception as e:
                logger.error(f"Failed to read file {file.file_path}: {e}")
                stats["files_skipped"] += 1
                stats["files_skipped_malformed"] += 1
                continue
                
            try:
                symbols = extractor.extract(file, source_code)
                stats["files_processed"] += 1
                if symbols:
                    stats["files_with_symbols"] += 1
                    stats["symbols_extracted"] += len(symbols)
                    new_symbols.extend(symbols)
            except Exception as e:
                # Catch parse failures or malformed code
                logger.error(f"Failed to extract symbols from {file.file_path}: {e}")
                stats["files_skipped"] += 1
                stats["files_skipped_malformed"] += 1
                
        # 3. Bulk insert new symbols
        if new_symbols:
            try:
                self.knowledge_repo.bulk_create_symbols(new_symbols)
            except Exception as e:
                logger.error(f"Failed to bulk create symbols: {e}")
                raise
                
        return stats
