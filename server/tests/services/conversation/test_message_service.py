import pytest
from unittest.mock import Mock, AsyncMock
from uuid import uuid4

from app.services.conversation.message_service import ConversationMessageService
from app.services.conversation.exceptions import ConversationNotFoundError
from app.schemas.message import ConversationMessageRequest
from app.services.rag_query.models import RAGQueryResponse
from app.services.citation.models import Citation as DomainCitation
from app.models.conversation import Conversation, Message

@pytest.fixture
def mocks():
    return {
        "conversation_repo": Mock(),
        "message_repo": Mock(),
        "rag_query_service": AsyncMock(),
    }

@pytest.fixture
def service(mocks):
    return ConversationMessageService(
        conversation_repo=mocks["conversation_repo"],
        message_repo=mocks["message_repo"],
        rag_query_service=mocks["rag_query_service"]
    )

@pytest.mark.asyncio
async def test_send_message_success(service, mocks):
    user_id = uuid4()
    conv_id = uuid4()
    repo_id = uuid4()
    version_id = uuid4()

    mock_conv = Conversation(id=conv_id, repository_id=repo_id, repository_version_id=version_id, user_id=user_id)
    mocks["conversation_repo"].get_for_user.return_value = mock_conv

    # Setup message repo to return the message it receives
    from datetime import datetime
    def mock_create(msg):
        msg.id = uuid4()
        msg.created_at = datetime.utcnow()
        if hasattr(msg, 'citations') and msg.citations:
            for c in msg.citations:
                c.id = uuid4()
        return msg
    mocks["message_repo"].create.side_effect = mock_create

    # Setup RAG response
    rag_resp = RAGQueryResponse(
        answer="Hello World",
        citations=(DomainCitation(
            citation_id="1",
            code_chunk_id=uuid4(),
            repository_version_id=version_id,
            file_id=uuid4(),
            file_path="main.py",
            start_line=1,
            end_line=10,
            retrieval_score=0.9,
            retrieval_source="semantic",
            chunk_index=0
        ),),
        repository_version_id=version_id
    )
    mocks["rag_query_service"].execute.return_value = rag_resp

    req = ConversationMessageRequest(content="Hi")
    resp = await service.send_message(user_id, conv_id, req)

    assert resp.user_message.content == "Hi"
    assert resp.assistant_message.content == "Hello World"
    assert len(resp.assistant_message.citations) == 1
    assert resp.repository_version_id == version_id

    # Verify transaction 1
    call1 = mocks["message_repo"].create.call_args_list[0][0][0]
    assert call1.role == "user"

    # Verify RAG call
    rag_call = mocks["rag_query_service"].execute.call_args[0][0]
    assert rag_call.repository_version_id == version_id
    assert rag_call.query == "Hi"

    # Verify transaction 2
    call2 = mocks["message_repo"].create.call_args_list[1][0][0]
    assert call2.role == "assistant"
    assert len(call2.citations) == 1

@pytest.mark.asyncio
async def test_unauthorized(service, mocks):
    mocks["conversation_repo"].get_for_user.return_value = None

    req = ConversationMessageRequest(content="Hi")
    with pytest.raises(ConversationNotFoundError):
        await service.send_message(uuid4(), uuid4(), req)
