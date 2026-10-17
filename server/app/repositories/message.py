from typing import Sequence
from uuid import UUID

from sqlalchemy import select, asc, func
from sqlalchemy.orm import Session, selectinload

from app.models.conversation import Message


class MessageRepository:
    """Repository for Message data access."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, message: Message) -> Message:
        from sqlalchemy.orm.attributes import set_committed_value

        self.db.add(message)
        self.db.flush()

        # Capture relations if needed or set empty to prevent lazy-load after expunge
        if "citations" not in message.__dict__:
            set_committed_value(message, "citations", [])

        self.db.expunge(message)
        if getattr(message, "citations", None):
            for citation in message.citations:
                if citation in self.db:
                    self.db.expunge(citation)

        self.db.commit()
        return message

    def get_by_id(self, message_id: UUID) -> Message | None:
        return self.db.execute(
            select(Message)
            .where(Message.id == message_id)
            .options(selectinload(Message.citations))
        ).scalar_one_or_none()

    def list_for_conversation(
        self, conversation_id: UUID, skip: int = 0, limit: int = 100
    ) -> tuple[Sequence[Message], int]:
        """Returns paginated messages for a conversation."""
        base_query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(selectinload(Message.citations))
        )
        
        total = self.db.execute(
            select(func.count()).select_from(Message).where(
                Message.conversation_id == conversation_id
            )
        ).scalar_one()

        items = self.db.execute(
            base_query.order_by(asc(Message.created_at), asc(Message.id))
            .offset(skip)
            .limit(limit)
        ).scalars().all()

        return items, total
