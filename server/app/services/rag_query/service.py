from app.repositories.repository import RepositoryRepository
from app.services.retrieval.service import RetrievalService
from app.services.retrieval.models import RetrievalRequest
from app.services.context.builder import ContextBuilder
from app.services.context.models import ContextRequest
from app.services.rag.service import RAGService
from app.services.rag.models import RAGRequest
from app.services.citation.service import CitationService
from app.services.citation.models import CitationRequest
from app.services.answer.service import AnswerService
from app.services.answer.models import AnswerRequest

from app.services.rag_query.models import RAGQueryRequest, RAGQueryResponse
from app.services.rag_query.exceptions import (
    InvalidQueryError,
    NoIndexedVersionError,
    InvalidRepositoryVersionError
)

class RAGQueryService:
    def __init__(
        self,
        repository_repo: RepositoryRepository,
        retrieval_service: RetrievalService,
        context_builder: ContextBuilder,
        rag_service: RAGService,
        citation_service: CitationService,
        answer_service: AnswerService,
    ):
        self.repository_repo = repository_repo
        self.retrieval_service = retrieval_service
        self.context_builder = context_builder
        self.rag_service = rag_service
        self.citation_service = citation_service
        self.answer_service = answer_service

    async def execute(self, request: RAGQueryRequest) -> RAGQueryResponse:
        # 1. Validate Query
        if not request.query.strip():
            raise InvalidQueryError("Query cannot be empty or whitespace only.")

        # 2. Resolve Repository Version
        resolved_version_id = None
        if request.repository_version_id is not None:
            version = self.repository_repo.get_version_by_id(request.repository_version_id)
            if not version:
                raise InvalidRepositoryVersionError(f"Version {request.repository_version_id} not found.")
            if version.repository_id != request.repository_id:
                raise InvalidRepositoryVersionError(f"Version {request.repository_version_id} does not belong to repository {request.repository_id}.")
            if version.index_status != "SUCCESS":
                raise InvalidRepositoryVersionError(f"Version {request.repository_version_id} is not successfully indexed.")
            resolved_version_id = version.id
        else:
            version = self.repository_repo.get_active_version(request.repository_id)
            if not version:
                raise NoIndexedVersionError(f"No active successfully indexed version found for repository {request.repository_id}.")
            resolved_version_id = version.id

        # 3. Retrieval
        retrieval_req = RetrievalRequest(
            repository_version_id=resolved_version_id,
            query=request.query,
            limit=request.retrieval_limit
        )
        retrieval_results = self.retrieval_service.search(retrieval_req)

        # 4. Context Assembly
        context_req = ContextRequest(
            query=request.query,
            retrieval_results=retrieval_results,
            max_context_chars=request.max_context_chars
        )
        assembled_context = self.context_builder.build(context_req)

        # 5. RAG Generation
        rag_req = RAGRequest(
            query=request.query,
            context=assembled_context
        )
        rag_res = await self.rag_service.answer_query(rag_req)

        # 6. Citation Extraction
        citation_req = CitationRequest(
            answer=rag_res.answer,
            context_items=rag_res.context_items
        )
        citation_res = self.citation_service.create_citations(citation_req)

        # 7. Final Answer Assembly
        answer_req = AnswerRequest(
            answer=rag_res.answer,
            citations=citation_res.citations
        )
        answer_res = self.answer_service.assemble(answer_req)

        # 8. Final Response
        return RAGQueryResponse(
            answer=answer_res.answer,
            citations=answer_res.citations,
            repository_version_id=resolved_version_id
        )
