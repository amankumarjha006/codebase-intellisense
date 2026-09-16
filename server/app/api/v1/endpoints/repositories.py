from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_db, get_current_user, get_authorized_repository
from app.models.user import User
from app.models.repository import Repository
from app.repositories.repository import RepositoryRepository
from app.services.repository import RepositoryService
from app.services.github import GithubService
from app.services.github_token import get_decrypted_token
from app.schemas.repository import (
    RepositoryListOut, 
    RepositoryCreate, 
    RepositoryOut, 
    RepositoryDetailOut, 
    RepositoryVersionSummary,
    RepositoryAnalyzeRequest,
    AnalyzeRepositoryOut,
    IndexJobOut
)
from app.core.encryption import TokenEncryptionError
from app.services.repository import (
    RepositoryServiceError,
    InvalidRepositoryUrlError,
    RepositoryNotAccessibleError,
    RepositoryActiveJobError
)
from app.services.github import GithubAuthError
from app.workers import enqueue_indexing_job

router = APIRouter()

@router.get("", response_model=RepositoryListOut, summary="List Repositories")
def get_repositories(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a paginated list of repositories the authenticated user has access to."""
    repo_repo = RepositoryRepository(db)
    items, total = repo_repo.list_for_user(
        user_id=current_user.id,
        page=page,
        limit=limit,
        search=search,
    )
    has_more = (page * limit) < total
    return RepositoryListOut(
        items=items,
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
):
    """Connects a GitHub repository for the authenticated user."""
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
        repository = await repo_service.connect_repository(
            user_id=current_user.id,
            url=request.url,
            github_access_token=token
        )
        return repository
    except InvalidRepositoryUrlError as e:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": str(e)
                }
            }
        )
    except RepositoryNotAccessibleError as e:
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "GITHUB_API_ERROR",
                    "message": str(e)
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
):
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

@router.post("/{repository_id}/analyze", response_model=AnalyzeRepositoryOut, status_code=status.HTTP_202_ACCEPTED, summary="Analyze Repository")
async def analyze_repository(
    repository_id: UUID,
    request: RepositoryAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    repository: Repository = Depends(get_authorized_repository),
    db: Session = Depends(get_db),
):
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
    except RepositoryActiveJobError as e:
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "code": "INDEXING_ALREADY_IN_PROGRESS",
                    "message": str(e)
                }
            }
        )
    except GithubAuthError as e:
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "GITHUB_API_ERROR",
                    "message": str(e)
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
):
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
):
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

