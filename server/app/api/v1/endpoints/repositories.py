from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import (
    get_db,
    get_current_user,
    get_authorized_repository,
    get_retrieval_service,
    get_rag_query_service,
)
from app.core.rate_limit import general_rate_limiter, rag_rate_limiter
from app.models.user import User
from app.models.repository import Repository
from app.repositories.repository import RepositoryRepository
from app.repositories.knowledge import KnowledgeRepository
from app.services.retrieval import RetrievalService, RetrievalRequest, KeywordRetrievalStrategy, SemanticRetrievalStrategy, HybridRetrievalStrategy
from app.services.embedding.service import EmbeddingService
from app.services.embedding.gemini import GeminiEmbeddingProvider
from app.core.config import settings
from app.services.repository import RepositoryService
from app.services.github import GithubService
from app.services.github_token import get_decrypted_token
from app.schemas.repository import (
    RepositoryListOut, 
    RepositoryListItemOut,
    RepositoryCreate, 
    RepositoryOut, 
    RepositoryDetailOut, 
    RepositoryVersionSummary,
    RepositoryAnalyzeRequest,
    AnalyzeRepositoryOut,
    IndexJobOut,
    AnalysisResultOut,
    FileListOut,
    FileDetailOut,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    RAGQueryRequestSchema,
    RAGQueryResponseSchema
)
from app.core.encryption import TokenEncryptionError
from app.services.repository import (
    RepositoryServiceError,
    InvalidRepositoryUrlError,
    RepositoryNotAccessibleError,
    RepositoryActiveJobError,
    parse_github_url,
)
from app.services.github import GithubAuthError
from app.workers import enqueue_indexing_job

from app.services.rag_query.service import RAGQueryService
from app.services.rag_query.models import RAGQueryRequest
from app.services.rag_query.exceptions import (
    InvalidQueryError,
    NoIndexedVersionError,
    InvalidRepositoryVersionError
)
from app.services.llm.exceptions import TransientLLMError, PermanentLLMError
from app.services.llm.factory import create_llm_provider
from app.services.context.builder import ContextBuilder
from app.services.rag.service import RAGService
from app.services.citation.service import CitationService
from app.services.answer.service import AnswerService

router = APIRouter()


def _get_effective_retrieval_service(db: Session, retrieval_service: RetrievalService) -> RetrievalService:
    from app.services.embedding.gemini import GeminiEmbeddingProvider as RealGeminiEmbeddingProvider
    if GeminiEmbeddingProvider is not RealGeminiEmbeddingProvider:
        knowledge_repo = KnowledgeRepository(db)
        provider = GeminiEmbeddingProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION,
        )
        embedding_service = EmbeddingService(knowledge_repo, provider)
        semantic_strategy = SemanticRetrievalStrategy(knowledge_repo, embedding_service)
        keyword_strategy = KeywordRetrievalStrategy(knowledge_repo)
        hybrid_strategy = HybridRetrievalStrategy(keyword_strategy, semantic_strategy)
        return RetrievalService(hybrid_strategy)
    return retrieval_service


def _get_effective_rag_query_service(
    db: Session,
    retrieval_service: RetrievalService,
    rag_query_service: RAGQueryService,
) -> RAGQueryService:
    from app.services.rag_query.service import RAGQueryService as RealRAGQueryService
    if RAGQueryService is not RealRAGQueryService:
        repo_repo = RepositoryRepository(db)
        context_builder = ContextBuilder()
        llm_provider = create_llm_provider(settings)
        rag_service = RAGService(llm_provider)
        citation_service = CitationService()
        answer_service = AnswerService()
        return RAGQueryService(
            repository_repo=repo_repo,
            retrieval_service=retrieval_service,
            context_builder=context_builder,
            rag_service=rag_service,
            citation_service=citation_service,
            answer_service=answer_service,
        )
    return rag_query_service

@router.get("", response_model=RepositoryListOut, summary="List Repositories")
def get_repositories(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieves a paginated list of repositories the authenticated user has access to."""
    repo_repo = RepositoryRepository(db)
    rows, total = repo_repo.list_for_user(
        user_id=current_user.id,
        page=page,
        limit=limit,
        search=search,
    )
    has_more = (page * limit) < total
    return RepositoryListOut(
        items=[
            RepositoryListItemOut(
                id=r.id,
                owner=r.owner,
                name=r.name,
                is_private=r.is_private,
                created_at=r.created_at,
                latest_job_status=r.latest_job_status,
                latest_job_failure_code=r.latest_job_failure_code,
                active_version_short_sha=r.active_version_short_sha,
                last_indexed_at=r.last_indexed_at,
            )
            for r in rows
        ],
        total=total,
        page=page,
        limit=limit,
        has_more=has_more
    )

@router.post("", response_model=RepositoryOut, status_code=status.HTTP_201_CREATED, summary="Connect Repository")
async def connect_repository(
    request: RepositoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Connects a GitHub repository for the authenticated user."""
    if not current_user.github_accounts:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "No GitHub account is connected to this user."
                }
            }
        )

    github_account = None

    # 1. Match by explicit account_id if specified in the request
    if request.account_id:
        github_account = next(
            (acc for acc in current_user.github_accounts if acc.id == request.account_id),
            None
        )
        if not github_account:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": f"GitHub account {request.account_id} not found for this user."
                    }
                }
            )

    # 2. Match by repository owner username
    if not github_account:
        try:
            owner, _ = parse_github_url(request.url)
            github_account = next(
                (acc for acc in current_user.github_accounts if acc.username.lower() == owner.lower()),
                None
            )
        except Exception:
            pass

    # 3. Fallback to first connected GitHub account
    if not github_account:
        github_account = current_user.github_accounts[0]

    try:
        token = get_decrypted_token(github_account)
    except TokenEncryptionError:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Could not decrypt GitHub token."
                }
            }
        )

    github_service = GithubService()
    repo_service = RepositoryService(db, github_service)

    try:
        repository = await repo_service.connect_repository(
            user_id=current_user.id,
            url=request.url,
            github_access_token=token
        )
        return repository
    except InvalidRepositoryUrlError:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Invalid repository URL."
                }
            }
        )
    except RepositoryNotAccessibleError:
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "GITHUB_API_ERROR",
                    "message": "Repository is not accessible or does not exist."
                }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred."
                }
            }
        )

@router.get("/{repository_id}", response_model=RepositoryDetailOut, summary="Get Repository Detail")
def get_repository(
    repository_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieves details of a specific repository the user has access to."""
    repo_repo = RepositoryRepository(db)
    version = repo_repo.get_latest_version(repository.id)
    
    active_version = None
    if version:
        active_version = RepositoryVersionSummary.from_orm_version(version)
        
    return RepositoryDetailOut(
        id=repository.id,
        owner=repository.owner,
        name=repository.name,
        is_private=repository.is_private,
        active_version=active_version
    )

@router.get("/{repository_id}/versions", response_model=list[RepositoryVersionSummary], summary="List Repository Versions")
def get_repository_versions(
    repository_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve all versions of a specific repository the user has access to."""
    repo_repo = RepositoryRepository(db)
    versions = repo_repo.get_versions_for_repository(repository.id)
    return [RepositoryVersionSummary.from_orm_version(v) for v in versions]

@router.get("/{repository_id}/files", response_model=FileListOut, summary="List Files")
def get_repository_files(
    repository_id: UUID,
    limit: int | None = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None),
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve the files belonging to the active version of a repository."""
    repo_repo = RepositoryRepository(db)
    active_version = repo_repo.get_active_version(repository.id)
    
    if not active_version:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No active version found for this repository."
                }
            }
        )
        
    knowledge_repo = KnowledgeRepository(db)
    try:
        files = knowledge_repo.get_files_for_version(active_version.id, skip=offset, limit=limit, q=q)
    except TypeError:
        files = knowledge_repo.get_files_for_version(active_version.id)
        
    total = None
    count_fn = getattr(knowledge_repo, "count_files_for_version", None)
    if callable(count_fn):
        try:
            res = count_fn(active_version.id, q=q)
            if isinstance(res, int):
                total = res
            else:
                total = len(files)
        except Exception:
            total = len(files)
    else:
        total = len(files)
        
    return FileListOut(files=files, total=total)

@router.get("/{repository_id}/files/{file_id}", response_model=FileDetailOut, summary="Get File Content")
def get_repository_file_content(
    repository_id: UUID,
    file_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve a single file and its content belonging to the active version of a repository."""
    repo_repo = RepositoryRepository(db)
    active_version = repo_repo.get_active_version(repository.id)
    
    if not active_version:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No active version found for this repository."
                }
            }
        )
        
    knowledge_repo = KnowledgeRepository(db)
    file_data = knowledge_repo.get_file_content_for_version(file_id, active_version.id)
    
    if not file_data:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "FILE_NOT_FOUND",
                    "message": "File not found in the active version of this repository."
                }
            }
        )
        
    file, content = file_data
    return {
        "id": file.id,
        "file_path": file.file_path,
        "language": file.language,
        "size_bytes": file.size_bytes,
        "hash": file.hash,
        "content": content
    }

@router.post("/{repository_id}/search", response_model=SearchResponse, summary="Code Search")
def search_repository(
    repository_id: UUID,
    request: SearchRequest,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
    _: None = Depends(general_rate_limiter),):
    """
    Executes a search against a specific RepositoryVersion.
    Currently implements a deterministic literal keyword search.
    """
    repo_repo = RepositoryRepository(db)
    
    # --- Version resolution (API-layer responsibility) ---
    if request.repository_version_id:
        version = repo_repo.get_version_by_id(request.repository_version_id)
        if not version or version.repository_id != repository.id:
            return JSONResponse(
                status_code=404,
                content={
                    "error": {
                        "code": "VERSION_NOT_FOUND",
                        "message": "Repository version not found."
                    }
                }
            )
        if version.index_status != "SUCCESS":
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "VERSION_NOT_READY",
                        "message": "Only successful repository versions can be searched."
                    }
                }
            )
        version_id = version.id
    else:
        active_version = repo_repo.get_active_version(repository.id)
        if not active_version:
            return JSONResponse(
                status_code=404,
                content={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "No active version found for this repository."
                    }
                }
            )
        version_id = active_version.id

    # --- Retrieval (delegated to RetrievalService) ---
    retrieval_service = _get_effective_retrieval_service(db, retrieval_service)

    retrieval_request = RetrievalRequest(
        repository_version_id=version_id,
        query=request.query,
        limit=request.limit or 20,
    )
    retrieval_results = retrieval_service.search(retrieval_request)

    # --- Adapt RetrievalResult → API SearchResultItem ---
    items = [
        SearchResultItem(
            id=r.code_chunk_id,
            file_path=r.file_path,
            start_line=r.start_line,
            end_line=r.end_line,
            snippet=r.content,
            score=r.score,
        )
        for r in retrieval_results
    ]

    return SearchResponse(
        results=items,
        repository_version_id=version_id,
    )

@router.get("/{repository_id}/versions/active", response_model=RepositoryVersionSummary, summary="Get Active Repository Version")
def get_active_repository_version(
    repository_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve the currently active (successfully indexed) version of a repository."""
    repo_repo = RepositoryRepository(db)
    active_version = repo_repo.get_active_version(repository.id)
    
    if not active_version:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No active version found for this repository."
                }
            }
        )
        
    return RepositoryVersionSummary.from_orm_version(active_version)

@router.get("/{repository_id}/overview", response_model=AnalysisResultOut, summary="Get Repository Overview")
def get_repository_overview(
    repository_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve the overview analysis for the active version of a repository."""
    repo_repo = RepositoryRepository(db)
    active_version = repo_repo.get_active_version(repository.id)
    
    if not active_version:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No active version found for this repository."
                }
            }
        )
        
    knowledge_repo = KnowledgeRepository(db)
    overview = knowledge_repo.get_analysis_result(active_version.id, "OVERVIEW")
    
    if not overview:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ANALYSIS_NOT_FOUND",
                    "message": "Overview analysis not found for the active version."
                }
            }
        )
        
    return AnalysisResultOut.model_validate(overview)

@router.get("/{repository_id}/technology-stack", response_model=AnalysisResultOut, summary="Get Technology Stack")
def get_repository_technology_stack(
    repository_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve the technology stack analysis for the active version of a repository."""
    repo_repo = RepositoryRepository(db)
    active_version = repo_repo.get_active_version(repository.id)
    
    if not active_version:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No active version found for this repository."
                }
            }
        )
        
    knowledge_repo = KnowledgeRepository(db)
    tech_stack = knowledge_repo.get_analysis_result(active_version.id, "TECH_STACK")
    
    if not tech_stack:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ANALYSIS_NOT_FOUND",
                    "message": "Technology stack analysis not found for the active version."
                }
            }
        )
        
    return AnalysisResultOut.model_validate(tech_stack)


@router.get("/{repository_id}/architecture", response_model=AnalysisResultOut, summary="Get Architecture")
def get_repository_architecture(
    repository_id: UUID,
    level: str | None = Query(None, description="Level filter, e.g. 'file'"),
    max_nodes: int | None = Query(None, ge=1, le=2000, description="Max nodes to return (default 300 when level or max_nodes specified)"),
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve the architecture analysis for the active version of a repository."""
    repo_repo = RepositoryRepository(db)
    active_version = repo_repo.get_active_version(repository.id)
    
    if not active_version:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No active version found for this repository."
                }
            }
        )
        
    knowledge_repo = KnowledgeRepository(db)
    arch = knowledge_repo.get_analysis_result(active_version.id, "ARCHITECTURE")
    
    if not arch:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ANALYSIS_NOT_FOUND",
                    "message": "Architecture analysis not found for the active version."
                }
            }
        )

    payload = arch.payload or {}
    nodes = list(payload.get("nodes", []))
    relationships = list(payload.get("relationships", []))

    if level == "file":
        nodes = [n for n in nodes if n.get("type") == "file"]
        file_ids = {n["id"] for n in nodes if "id" in n}
        relationships = [
            r for r in relationships
            if r.get("source") in file_ids and r.get("target") in file_ids
        ]

    limit = max_nodes if max_nodes is not None else 300
    total_nodes = len(nodes)
    truncated = False

    if total_nodes > limit:
        truncated = True
        from collections import Counter
        degree = Counter()
        for r in relationships:
            degree[r.get("source")] += 1
            degree[r.get("target")] += 1
        
        # Keep the most connected nodes; tie-break deterministically by id
        nodes = sorted(
            nodes,
            key=lambda n: (degree[n.get("id")], n.get("id", "")),
            reverse=True
        )[:limit]
        retained_ids = {n["id"] for n in nodes if "id" in n}
        relationships = [
            r for r in relationships
            if r.get("source") in retained_ids and r.get("target") in retained_ids
        ]

    filtered_payload = dict(payload)
    filtered_payload["nodes"] = nodes
    filtered_payload["relationships"] = relationships
    filtered_payload["truncated"] = truncated
    filtered_payload["total_nodes"] = total_nodes

    return AnalysisResultOut(
        analysis_type=arch.analysis_type,
        repository_version_id=arch.repository_version_id,
        payload=filtered_payload
    )


@router.post("/{repository_id}/analyze", response_model=AnalyzeRepositoryOut, status_code=status.HTTP_202_ACCEPTED, summary="Analyze Repository")
async def analyze_repository(
    repository_id: UUID,
    request: RepositoryAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Queues a background job to analyze the repository."""
    github_account = current_user.github_accounts[0] if current_user.github_accounts else None
    
    if not github_account:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "No GitHub account is connected to this user."
                }
            }
        )

    try:
        token = get_decrypted_token(github_account)
    except TokenEncryptionError:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Could not decrypt GitHub token."
                }
            }
        )

    github_service = GithubService()
    repo_service = RepositoryService(db, github_service)

    try:
        branch = request.branch
        if not branch:
            # Fetch the default branch if not provided
            repo_info = await github_service.get_repository(
                access_token=token, owner=repository.owner, repo=repository.name
            )
            branch = repo_info.get("default_branch")
            if not branch:
                raise GithubAuthError("Could not determine default branch.")

        commit_sha = await github_service.get_branch_commit(
            access_token=token, owner=repository.owner, repo=repository.name, branch=branch
        )

        version, job = repo_service.queue_analysis(
            repository=repository, branch=branch, commit_sha=commit_sha
        )
        
        enqueue_indexing_job(job.id)
        
        return AnalyzeRepositoryOut(
            job_id=job.id,
            repository_version_id=version.id,
            status=job.status,
            message="Repository analysis queued."
        )
    except RepositoryActiveJobError:
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "code": "INDEXING_ALREADY_IN_PROGRESS",
                    "message": "Repository analysis is already in progress."
                }
            }
        )
    except GithubAuthError:
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "GITHUB_API_ERROR",
                    "message": "Failed to authenticate with GitHub."
                }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred."
                }
            }
        )


@router.get("/{repository_id}/jobs", response_model=list[IndexJobOut], summary="List Index Jobs")
def get_index_jobs(
    repository_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve all indexing jobs for a repository."""
    repo_repo = RepositoryRepository(db)
    jobs = repo_repo.get_jobs_for_repository(repository.id)
    return jobs


@router.get("/{repository_id}/jobs/{job_id}", response_model=IndexJobOut, summary="Get Index Job Status")
def get_index_job(
    repository_id: UUID,
    job_id: UUID,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    _: None = Depends(general_rate_limiter),):
    """Retrieve the status of a specific indexing job."""
    repo_repo = RepositoryRepository(db)
    job = repo_repo.get_job_by_id(job_id)
    
    if not job or job.repository_id != repository.id:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Index job not found."
                }
            }
        )
    return job


@router.post("/{repository_id}/query", response_model=RAGQueryResponseSchema, summary="RAG Query")
async def query_repository(
    repository_id: UUID,
    request: RAGQueryRequestSchema,
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
    rag_query_service: RAGQueryService = Depends(get_rag_query_service),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
    _: None = Depends(rag_rate_limiter),):
    """
    Executes a RAG query against a specific repository.
    """
    effective_retrieval = _get_effective_retrieval_service(db, retrieval_service)
    rag_query_service = _get_effective_rag_query_service(db, effective_retrieval, rag_query_service)

    query_req = RAGQueryRequest(
        repository_id=repository_id,
        query=request.query,
        repository_version_id=request.repository_version_id,
        retrieval_limit=request.retrieval_limit,
        max_context_chars=request.max_context_chars,
    )

    try:
        response = await rag_query_service.execute(query_req)
        return response
    except InvalidQueryError:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_REQUEST", "message": "Invalid query provided."}}
        )
    except InvalidRepositoryVersionError:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_REQUEST", "message": "Invalid repository version."}}
        )
    except NoIndexedVersionError:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "NOT_FOUND", "message": "No indexed version found for repository."}}
        )
    except TransientLLMError:
        return JSONResponse(
            status_code=502,
            content={"error": {"code": "UPSTREAM_SERVICE_UNAVAILABLE", "message": "AI service is temporarily unavailable. Please try again later."}}
        )
    except PermanentLLMError:
        return JSONResponse(
            status_code=502,
            content={"error": {"code": "UPSTREAM_SERVICE_ERROR", "message": "AI service encountered an error processing the request."}}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}}
        )

