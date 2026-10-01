from typing import Sequence
from uuid import UUID

from app.models.conversation import Conversation, Message
from app.models.repository import Repository
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.services.conversation.exceptions import (
    ConversationNotFoundError,
    ActiveVersionNotFoundError,
)


class ConversationService:
    def __init__(
        self,
        conversation_repo: ConversationRepository,
        message_repo: MessageRepository,
    ):
        self.conversation_repo = conversation_repo
        self.message_repo = message_repo

    def create_conversation(
        self, user_id: UUID, repository: Repository, title: str | None = None
    ) -> Conversation:
        """
        Creates a new conversation attached to the active repository version.
        Raises ActiveVersionNotFoundError if the repository has no active indexed version.
        """
        from app.repositories.repository import RepositoryRepository
        
        # We need the active version. Since repository might not have the versions loaded,
        # we can fetch it explicitly.
        repo_repo = RepositoryRepository(self.conversation_repo.db)
        active_version = repo_repo.get_active_version(repository.id)

        if not active_version:
            raise ActiveVersionNotFoundError(
                f"Repository {repository.id} has no active indexed version."
            )

        conversation = Conversation(
            user_id=user_id,
            repository_id=repository.id,
            repository_version_id=active_version.id,
            title=title,
        )
        return self.conversation_repo.create(conversation)

    def get_conversation(self, conversation_id: UUID, user_id: UUID) -> Conversation:
        """
        Retrieves a conversation ensuring it belongs to the user.
        Raises ConversationNotFoundError otherwise.
        """
        conversation = self.conversation_repo.get_for_user(conversation_id, user_id)
        if not conversation:
            raise ConversationNotFoundError(f"Conversation {conversation_id} not found.")
        return conversation

    def list_conversations(
        self, user_id: UUID, repository: Repository, skip: int = 0, limit: int = 100
    ) -> tuple[Sequence[Conversation], int]:
        """
        Lists conversations for a user in a repository.
        """
        return self.conversation_repo.list_for_user(
            user_id=user_id, repository_id=repository.id, skip=skip, limit=limit
        )

    def delete_conversation(self, conversation_id: UUID, user_id: UUID) -> None:
        """
        Deletes a conversation ensuring it belongs to the user.
        Raises ConversationNotFoundError otherwise.
        """
        conversation = self.get_conversation(conversation_id, user_id)
        self.conversation_repo.delete(conversation)

    def list_messages(
        self, conversation_id: UUID, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> tuple[Sequence[Message], int]:
        """
        Lists messages for a conversation, ensuring the conversation belongs to the user.
        """
        # Validate conversation ownership
        self.get_conversation(conversation_id, user_id)

        return self.message_repo.list_for_conversation(
            conversation_id=conversation_id, skip=skip, limit=limit
        )
