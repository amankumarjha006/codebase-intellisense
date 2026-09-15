from sqlalchemy.orm import Session
from app.models.knowledge import File

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
