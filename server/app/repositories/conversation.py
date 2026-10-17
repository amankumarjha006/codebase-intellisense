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
        from sqlalchemy import func
        from app.models.conversation import Message

        total = self.db.execute(
            select(func.count()).select_from(Conversation).where(
                Conversation.user_id == user_id,
                Conversation.repository_id == repository_id
            )
        ).scalar_one()

        msg_count_subquery = (
            select(func.count(Message.id))
            .where(Message.conversation_id == Conversation.id)
            .scalar_subquery()
        )
        last_msg_subquery = (
            select(func.max(Message.created_at))
            .where(Message.conversation_id == Conversation.id)
            .scalar_subquery()
        )

        query = (
            select(
                Conversation,
                msg_count_subquery.label("message_count"),
                last_msg_subquery.label("last_message_at"),
            )
            .where(
                Conversation.user_id == user_id,
                Conversation.repository_id == repository_id
            )
            .order_by(desc(Conversation.created_at), desc(Conversation.id))
            .offset(skip)
            .limit(limit)
        )

        rows = self.db.execute(query).all()
        items = []
        for conv, count, last_at in rows:
            conv.message_count = count or 0
            conv.last_message_at = last_at
            items.append(conv)

        return items, total

    def delete(self, conversation: Conversation) -> None:
        self.db.delete(conversation)
        self.db.commit()
