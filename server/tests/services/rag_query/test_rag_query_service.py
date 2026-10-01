import pytest
import uuid
from unittest.mock import Mock, AsyncMock

from app.services.rag_query.models import RAGQueryRequest, RAGQueryResponse
from app.services.rag_query.exceptions import (
    InvalidQueryError,
    NoIndexedVersionError,
    InvalidRepositoryVersionError
)
from app.services.rag_query.service import RAGQueryService

from app.repositories.repository import RepositoryRepository
from app.services.retrieval.service import RetrievalService
from app.services.retrieval.models import RetrievalRequest
from app.services.context.builder import ContextBuilder
from app.services.context.models import ContextRequest, AssembledContext
from app.services.rag.service import RAGService
from app.services.rag.models import RAGRequest, RAGResponse
from app.services.citation.service import CitationService
from app.services.citation.models import CitationRequest, CitationResponse
from app.services.answer.service import AnswerService
from app.services.answer.models import AnswerRequest, AnswerResponse
from app.services.llm.exceptions import TransientLLMError, PermanentLLMError


@pytest.fixture
def repo_repo():
    return Mock(spec=RepositoryRepository)

@pytest.fixture
def retrieval_service():
    return Mock(spec=RetrievalService)

@pytest.fixture
def context_builder():
    return Mock(spec=ContextBuilder)

@pytest.fixture
def rag_service():
    return AsyncMock(spec=RAGService)

@pytest.fixture
def citation_service():
    return Mock(spec=CitationService)

@pytest.fixture
def answer_service():
    return Mock(spec=AnswerService)

@pytest.fixture
def rag_query_service(
    repo_repo, retrieval_service, context_builder, 
    rag_service, citation_service, answer_service
):
    return RAGQueryService(
        repository_repo=repo_repo,
        retrieval_service=retrieval_service,
        context_builder=context_builder,
        rag_service=rag_service,
        citation_service=citation_service,
        answer_service=answer_service
    )


@pytest.mark.asyncio
async def test_happy_path_active_version(
    rag_query_service, repo_repo, retrieval_service, context_builder,
    rag_service, citation_service, answer_service
):
    # Setup
    repo_id = uuid.uuid4()
    version_id = uuid.uuid4()
    query = "How do I build this?"
    
    mock_version = Mock()
    mock_version.id = version_id
    repo_repo.get_active_version.return_value = mock_version
    
    retrieval_service.search.return_value = ["mock_retrieval_result"]
    
    mock_context = Mock(spec=AssembledContext)
    context_builder.build.return_value = mock_context
    
    mock_rag_response = Mock(spec=RAGResponse)
    mock_rag_response.answer = "Build it like this."
    mock_rag_response.context_items = ["mock_context_item"]
    rag_service.answer_query.return_value = mock_rag_response
    
    mock_citation_response = Mock(spec=CitationResponse)
    mock_citation_response.citations = tuple(["mock_citation"])
    citation_service.create_citations.return_value = mock_citation_response
    
    mock_answer_response = Mock(spec=AnswerResponse)
    mock_answer_response.answer = "Build it like this."
    mock_answer_response.citations = tuple(["mock_citation"])
    answer_service.assemble.return_value = mock_answer_response

    req = RAGQueryRequest(repository_id=repo_id, query=query, retrieval_limit=15, max_context_chars=1000)
    
    # Execute
    res = await rag_query_service.execute(req)
    
    # Assert
    repo_repo.get_active_version.assert_called_once_with(repo_id)
    retrieval_service.search.assert_called_once()
    assert retrieval_service.search.call_args[0][0].repository_version_id == version_id
    assert retrieval_service.search.call_args[0][0].query == query
    assert retrieval_service.search.call_args[0][0].limit == 15
    
    context_builder.build.assert_called_once()
    assert context_builder.build.call_args[0][0].max_context_chars == 1000
    assert context_builder.build.call_args[0][0].retrieval_results == ["mock_retrieval_result"]
    
    rag_service.answer_query.assert_called_once()
    assert rag_service.answer_query.call_args[0][0].query == query
    assert rag_service.answer_query.call_args[0][0].context == mock_context
    
    citation_service.create_citations.assert_called_once()
    assert citation_service.create_citations.call_args[0][0].answer == "Build it like this."
    
    answer_service.assemble.assert_called_once()
    
    assert isinstance(res, RAGQueryResponse)
    assert res.answer == "Build it like this."
    assert res.citations == tuple(["mock_citation"])
    assert res.repository_version_id == version_id


@pytest.mark.asyncio
async def test_explicit_version(
    rag_query_service, repo_repo, retrieval_service, context_builder,
    rag_service, citation_service, answer_service
):
    repo_id = uuid.uuid4()
    version_id = uuid.uuid4()
    
    mock_version = Mock()
    mock_version.id = version_id
    mock_version.repository_id = repo_id
    mock_version.index_status = "SUCCESS"
    repo_repo.get_version_by_id.return_value = mock_version
    
    # mock remaining services to just not crash
    retrieval_service.search.return_value = []
    context_builder.build.return_value = Mock()
    mock_rag = Mock()
    mock_rag.answer = ""
    mock_rag.context_items = ()
    rag_service.answer_query.return_value = mock_rag
    citation_service.create_citations.return_value = Mock(citations=())
    answer_service.assemble.return_value = Mock(answer="", citations=())
    
    req = RAGQueryRequest(repository_id=repo_id, query="query", repository_version_id=version_id)
    res = await rag_query_service.execute(req)
    
    repo_repo.get_version_by_id.assert_called_once_with(version_id)
    assert res.repository_version_id == version_id

@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_query", ["", "   ", "\n\t"])
async def test_query_validation(rag_query_service, repo_repo, invalid_query):
    req = RAGQueryRequest(repository_id=uuid.uuid4(), query=invalid_query)
    with pytest.raises(InvalidQueryError):
        await rag_query_service.execute(req)
    repo_repo.get_active_version.assert_not_called()

@pytest.mark.asyncio
async def test_invalid_explicit_version(rag_query_service, repo_repo):
    repo_id = uuid.uuid4()
    version_id = uuid.uuid4()
    
    # Not found
    repo_repo.get_version_by_id.return_value = None
    req = RAGQueryRequest(repository_id=repo_id, query="q", repository_version_id=version_id)
    with pytest.raises(InvalidRepositoryVersionError):
        await rag_query_service.execute(req)
        
    # Wrong repo
    mock_version = Mock(id=version_id, repository_id=uuid.uuid4(), index_status="SUCCESS")
    repo_repo.get_version_by_id.return_value = mock_version
    with pytest.raises(InvalidRepositoryVersionError):
        await rag_query_service.execute(req)
        
    # Wrong status
    mock_version = Mock(id=version_id, repository_id=repo_id, index_status="PENDING")
    repo_repo.get_version_by_id.return_value = mock_version
    with pytest.raises(InvalidRepositoryVersionError):
        await rag_query_service.execute(req)


@pytest.mark.asyncio
async def test_no_indexed_version(rag_query_service, repo_repo):
    repo_repo.get_active_version.return_value = None
    req = RAGQueryRequest(repository_id=uuid.uuid4(), query="q")
    with pytest.raises(NoIndexedVersionError):
        await rag_query_service.execute(req)


@pytest.mark.asyncio
async def test_empty_retrieval(
    rag_query_service, repo_repo, retrieval_service, context_builder, rag_service, citation_service, answer_service
):
    repo_id = uuid.uuid4()
    mock_version = Mock(id=uuid.uuid4())
    repo_repo.get_active_version.return_value = mock_version
    
    # Retrieval returns empty list
    retrieval_service.search.return_value = []
    mock_context = Mock(spec=AssembledContext)
    context_builder.build.return_value = mock_context
    mock_rag = Mock(answer="I don't know", context_items=())
    rag_service.answer_query.return_value = mock_rag
    citation_service.create_citations.return_value = Mock(citations=())
    answer_service.assemble.return_value = Mock(answer="I don't know", citations=())
    
    req = RAGQueryRequest(repository_id=repo_id, query="query")
    res = await rag_query_service.execute(req)
    
    context_builder.build.assert_called_once()
    assert context_builder.build.call_args[0][0].retrieval_results == []
    
    rag_service.answer_query.assert_called_once()
    assert rag_service.answer_query.call_args[0][0].context == mock_context
    assert res.answer == "I don't know"


@pytest.mark.asyncio
async def test_rag_failure_propagation(
    rag_query_service, repo_repo, retrieval_service, context_builder, rag_service
):
    repo_repo.get_active_version.return_value = Mock(id=uuid.uuid4())
    retrieval_service.search.return_value = []
    context_builder.build.return_value = Mock()
    
    rag_service.answer_query.side_effect = TransientLLMError("Temporary issue")
    
    req = RAGQueryRequest(repository_id=uuid.uuid4(), query="query")
    with pytest.raises(TransientLLMError):
        await rag_query_service.execute(req)
