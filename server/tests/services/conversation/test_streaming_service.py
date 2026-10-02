import pytest
from unittest.mock import Mock, AsyncMock
from uuid import uuid4

from app.services.conversation.streaming_service import ConversationStreamingService
from app.schemas.message import ConversationMessageRequest
from app.models.conversation import Conversation, Message
from app.services.rag_query.models import RAGQueryResponse
from app.services.citation.models import CitationResponse, Citation as DomainCitation
from app.services.answer.models import AnswerResponse
from app.services.conversation.query_rewriter import RewrittenQueryResponse

@pytest.fixture
def mocks():
    return {
        "conversation_repo": Mock(),
        "message_repo": Mock(),
        "repository_repo": Mock(),
        "query_rewriter": AsyncMock(),
        "retrieval_service": Mock(),
        "context_builder": Mock(),
        "rag_service": Mock(),
        "citation_service": Mock(),
        "answer_service": Mock(),
        "redis_client": AsyncMock()
    }

@pytest.fixture
def service(mocks):
    return ConversationStreamingService(
        conversation_repo=mocks["conversation_repo"],
        message_repo=mocks["message_repo"],
        repository_repo=mocks["repository_repo"],
        query_rewriter=mocks["query_rewriter"],
        retrieval_service=mocks["retrieval_service"],
        context_builder=mocks["context_builder"],
        rag_service=mocks["rag_service"],
        citation_service=mocks["citation_service"],
        answer_service=mocks["answer_service"],
        redis_client=mocks["redis_client"]
    )

@pytest.mark.asyncio
async def test_stream_message_success(service, mocks):
    user_id = uuid4()
    conv_id = uuid4()
    version_id = uuid4()

    mock_conv = Conversation(id=conv_id, repository_version_id=version_id)
    mocks["conversation_repo"].get_for_user.return_value = mock_conv

    mock_version = Mock(index_status="SUCCESS")
    mocks["repository_repo"].get_version_by_id.return_value = mock_version

    mocks["redis_client"].set.return_value = True

    def mock_create(msg):
        msg.id = uuid4()
        return msg
    mocks["message_repo"].create.side_effect = mock_create
    mocks["message_repo"].list_for_conversation.return_value = ([], 0)

    mocks["query_rewriter"].rewrite.return_value = RewrittenQueryResponse(query="test", was_rewritten=False)
    
    mock_retrieval_res = Mock()
    mock_retrieval_res.chunks = []
    mocks["retrieval_service"].search.return_value = mock_retrieval_res
    
    mock_context = Mock()
    mock_context.items = []
    mocks["context_builder"].build.return_value = mock_context
    
    async def mock_stream_answer(*args, **kwargs):
        yield "Hello"
        yield " World"
    mocks["rag_service"].stream_answer_query.side_effect = mock_stream_answer
    
    mocks["citation_service"].create_citations.return_value = CitationResponse(citations=tuple())
    mocks["answer_service"].assemble.return_value = AnswerResponse(answer="Hello World", citations=tuple())

    req = ConversationMessageRequest(content="Hi")
    gen = service.stream_message(user_id, conv_id, req)
    
    events = []
    async for event in gen:
        events.append(event)

    assert any("message_start" in e for e in events)
    assert any("token" in e and "Hello" in e for e in events)
    assert any("token" in e and " World" in e for e in events)
    assert any("message_complete" in e for e in events)
    assert not any("error" in e for e in events)

    # Check lock released
    mocks["redis_client"].eval.assert_called_once()
    
    # Check transactions
    assert mocks["message_repo"].create.call_count == 2
    calls = mocks["message_repo"].create.call_args_list
    assert calls[0][0][0].role == "user"
    assert calls[1][0][0].role == "assistant"
    assert calls[1][0][0].content == "Hello World"

@pytest.mark.asyncio
async def test_stream_message_concurrent(service, mocks):
    mocks["redis_client"].set.return_value = False
    
    req = ConversationMessageRequest(content="Hi")
    gen = service.stream_message(uuid4(), uuid4(), req)
    
    events = []
    async for event in gen:
        events.append(event)
        
    assert len(events) == 1
    assert "error" in events[0]
    assert "CONVERSATION_GENERATION_IN_PROGRESS" in events[0]
