from uuid import UUID

from app.models.conversation import Message, Citation
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.services.rag_query.service import RAGQueryService
from app.services.rag_query.models import RAGQueryRequest
from app.services.conversation.exceptions import ConversationNotFoundError
from app.schemas.message import ConversationMessageRequest, ConversationMessageResponse, MessageOutWithCitations, MessageCitationOut

class ConversationMessageService:
    def __init__(
        self,
        conversation_repo: ConversationRepository,
        message_repo: MessageRepository,
        rag_query_service: RAGQueryService,
    ):
        self.conversation_repo = conversation_repo
        self.message_repo = message_repo
        self.rag_query_service = rag_query_service

    async def send_message(
        self,
        user_id: UUID,
        conversation_id: UUID,
        request: ConversationMessageRequest
    ) -> ConversationMessageResponse:
        # 1. Validate conversation access/context
        conversation = self.conversation_repo.get_for_user(conversation_id, user_id)
        if not conversation:
            raise ConversationNotFoundError(f"Conversation {conversation_id} not found.")

        # 2. Persist the user's message (Transaction 1)
        user_msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=request.content
        )
        # MessageRepository.create automatically commits the transaction.
        user_msg = self.message_repo.create(user_msg)

        # 3. Invoke RAGQueryService (Network I/O without holding an open DB transaction)
        rag_request = RAGQueryRequest(
            repository_id=conversation.repository_id,
            query=request.content,
            repository_version_id=conversation.repository_version_id
        )
        rag_response = await self.rag_query_service.execute(rag_request)

        # 4. Persist the assistant message and citations (Transaction 2)
        assistant_msg = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=rag_response.answer
        )
        
        # Map authoritative citations preserving original provenance
        citations = []
        for c in rag_response.citations:
            citations.append(
                Citation(
                    code_chunk_id=c.code_chunk_id,
                    file_path=c.file_path,
                    start_line=c.start_line,
                    end_line=c.end_line
                )
            )
        assistant_msg.citations = citations
        
        # MessageRepository.create commits the assistant message and nested citations.
        assistant_msg = self.message_repo.create(assistant_msg)

        # 5. Return structured result
        return ConversationMessageResponse(
            user_message=MessageOutWithCitations.model_validate(user_msg),
            assistant_message=MessageOutWithCitations.model_validate(assistant_msg),
            repository_version_id=conversation.repository_version_id
        )
