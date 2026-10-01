from typing import Sequence
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.models.conversation import Conversation


class ConversationRepository:
    """Repository for Conversation data access."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, conversation: Conversation) -> Conversation:
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def get_by_id(self, conversation_id: UUID) -> Conversation | None:
        return self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        ).scalar_one_or_none()

    def get_for_user(self, conversation_id: UUID, user_id: UUID) -> Conversation | None:
        return self.db.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .where(Conversation.user_id == user_id)
        ).scalar_one_or_none()

    def list_for_user(
        self, user_id: UUID, repository_id: UUID, skip: int = 0, limit: int = 100
    ) -> tuple[Sequence[Conversation], int]:
        """Returns paginated conversations for a user in a repository."""
        base_query = select(Conversation).where(
            Conversation.user_id == user_id,
            Conversation.repository_id == repository_id
        )
        
        from sqlalchemy import func
        total = self.db.execute(
            select(func.count()).select_from(Conversation).where(
                Conversation.user_id == user_id,
                Conversation.repository_id == repository_id
            )
        ).scalar_one()

        items = self.db.execute(
            base_query.order_by(desc(Conversation.created_at), desc(Conversation.id))
            .offset(skip)
            .limit(limit)
        ).scalars().all()

        return items, total

    def delete(self, conversation: Conversation) -> None:
        self.db.delete(conversation)
        self.db.commit()
