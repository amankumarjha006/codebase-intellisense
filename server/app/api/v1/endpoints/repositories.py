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
    RepositoryVersionSummary
)
from app.core.encryption import TokenEncryptionError
from app.services.repository import RepositoryServiceError, InvalidRepositoryUrlError, RepositoryNotAccessibleError

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
