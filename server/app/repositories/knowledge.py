from sqlalchemy.orm import Session
from sqlalchemy import delete
from uuid import UUID
from app.models.knowledge import File, Symbol

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
