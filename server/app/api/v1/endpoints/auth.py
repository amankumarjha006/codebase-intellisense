from fastapi import APIRouter, Depends, Request, Response, Query, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
import redis.asyncio as redis
import secrets
import logging
from typing import Optional

from app.core.config import settings
from app.api.deps import get_db, get_redis, get_current_user, AuthException
from app.services.github import GithubService, GithubAuthError
from app.services.auth import AuthService
from app.models.user import User, GithubAccount, GithubInstallation
from app.schemas.auth import UserOut

logger = logging.getLogger(__name__)
router = APIRouter()
github_service = GithubService()

from urllib.parse import urlparse

def _build_frontend_redirect_url(error_code: str) -> str:
    """Builds a redirect URL to the frontend origin root with an error query parameter."""
    parsed = urlparse(settings.FRONTEND_URL)
    return f"{parsed.scheme}://{parsed.netloc}/?error={error_code}"

@router.get("/github", summary="Initiate GitHub App Authorization")
async def login_github(request: Request, redis_client: redis.Redis = Depends(get_redis)):
    """Initiates the GitHub App user authorization flow."""
    try:
        # Generate random CSRF state
        state = secrets.token_urlsafe(32)
        
        # Store state in Redis with 10 minute expiration
        state_key = f"oauth_state:{state}"
        await redis_client.setex(state_key, 600, "1")
        
        # Construct authorization URL
        auth_url = github_service.get_authorization_url(state)
        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as e:
        req_id = getattr(request.state, "request_id", None) or request.headers.get(settings.REQUEST_ID_HEADER)
        logger.exception("login_github_failed", extra={"request_id": req_id, "error_detail": str(e)})
        return RedirectResponse(url=_build_frontend_redirect_url("login_failed"), status_code=302)

@router.get("/dev-login", summary="Dev Environment Auto-Login")
async def dev_login(
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Provisions or loads a development user and sets a real session cookie."""
    if settings.ENVIRONMENT != "development":
        return JSONResponse(status_code=403, content={"error": "Dev login only available in development"})

    try:
        auth_service = AuthService(db)
        user = auth_service.provision_user_and_installation(
            github_user_data={
                "github_user_id": "123456",
                "username": "alexc-dev",
                "email": "alex.chen@devtools.co",
                "full_name": "Alex Chen",
            },
            access_token="dev-mock-access-token",
            verified_installation=None,
            installation_id=None,
        )

        session_id = secrets.token_urlsafe(32)
        await redis_client.setex(
            f"session:{session_id}",
            settings.SESSION_EXPIRE_SECONDS,
            str(user.id),
        )

        redirect_url = settings.FRONTEND_URL
        redirect_response = RedirectResponse(url=redirect_url, status_code=302)
        redirect_response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_id,
            max_age=settings.SESSION_EXPIRE_SECONDS,
            httponly=True,
            secure=False,
            samesite="lax",
        )
        return redirect_response
    except Exception as e:
        logger.exception("dev_login_failed", extra={"error_detail": str(e)})
        return JSONResponse(status_code=500, content={"error": "Failed to create dev session", "detail": str(e)})

@router.get("/github/callback", summary="GitHub Auth Callback")
async def github_callback(
    request: Request,
    response: Response,
    code: Optional[str] = Query(None, description="Authorization code from GitHub"),
    state: Optional[str] = Query(None, description="CSRF state token"),
    error: Optional[str] = Query(None, description="Error code from GitHub"),
    error_description: Optional[str] = Query(None, description="Error description from GitHub"),
    installation_id: Optional[str] = Query(None, description="GitHub App Installation ID"),
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Handles the GitHub code exchange, provisions the user, and issues a session cookie."""
    req_id = getattr(request.state, "request_id", None) or request.headers.get(settings.REQUEST_ID_HEADER)

    # 1. GitHub access denied or missing code
    if error or not code:
        logger.warning(
            "authentication_access_denied",
            extra={
                "github_error": error,
                "error_description": error_description,
                "request_id": req_id,
            }
        )
        return RedirectResponse(url=_build_frontend_redirect_url("access_denied"), status_code=302)

    # 2. Validate State
    if not state:
        logger.warning("authentication_failure", extra={"reason": "missing_oauth_state", "request_id": req_id})
        return RedirectResponse(url=_build_frontend_redirect_url("login_failed"), status_code=302)

    state_key = f"oauth_state:{state}"
    try:
        # Atomic get and delete
        state_value = await redis_client.getdel(state_key)
    except Exception as e:
        logger.exception("oauth_state_redis_error", extra={"error_detail": str(e), "request_id": req_id})
        return RedirectResponse(url=_build_frontend_redirect_url("login_failed"), status_code=302)
    
    if not state_value:
        logger.warning("authentication_failure", extra={"reason": "invalid_oauth_state", "request_id": req_id})
        return RedirectResponse(url=_build_frontend_redirect_url("login_failed"), status_code=302)
        
    try:
        # 3. Exchange code for access token
        access_token = await github_service.exchange_code_for_token(code)
        
        # 4. Resolve authenticated GitHub user
        github_user_data = await github_service.get_authenticated_user(access_token)
        
        github_user_id = github_user_data["github_user_id"]
        username = github_user_data["username"]
        email = github_user_data["email"]
        full_name = github_user_data["full_name"]
        
        # 5. Installation verification (Network Call)
        verified_installation = None
        if installation_id:
            verified_installation = await github_service.verify_user_installation(access_token, installation_id)
            if not verified_installation:
                logger.warning(
                    f"Installation ID {installation_id} could not be verified for user {username}",
                    extra={"request_id": req_id}
                )
        
        # 6. Provisioning Transaction (Database operations)
        auth_service = AuthService(db)
        user = auth_service.provision_user_and_installation(
            github_user_data=github_user_data,
            access_token=access_token,
            verified_installation=verified_installation,
            installation_id=installation_id
        )
        
        # 7. Create application authentication session
        session_id = secrets.token_urlsafe(32)
        await redis_client.setex(
            f"session:{session_id}", 
            settings.SESSION_EXPIRE_SECONDS, 
            str(user.id)
        )
        
        # 8. Redirect to frontend with HTTP-only cookie
        redirect_url = settings.FRONTEND_URL
        redirect_response = RedirectResponse(url=redirect_url, status_code=302)
        redirect_response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_id,
            max_age=settings.SESSION_EXPIRE_SECONDS,
            httponly=True,
            secure=(settings.ENVIRONMENT == "production"),
            samesite="lax",  # Adjust based on exact frontend/backend domain structure
        )
        
        logger.info("authentication_success", extra={"user_id": str(user.id), "request_id": req_id})
        return redirect_response

    except GithubAuthError as e:
        logger.warning("authentication_failure", extra={"reason": str(e), "request_id": req_id})
        db.rollback()
        return RedirectResponse(url=_build_frontend_redirect_url("login_failed"), status_code=302)
    except Exception as e:
        db.rollback()
        logger.exception("Unexpected error during GitHub callback", extra={"request_id": req_id})
        return RedirectResponse(url=_build_frontend_redirect_url("login_failed"), status_code=302)

@router.get("/me", response_model=UserOut, summary="Get Current User")
async def get_me(current_user: User = Depends(get_current_user)):
    """Retrieves the authenticated user's profile."""
    # Assuming one Github account for MVP
    github_account = current_user.github_accounts[0] if current_user.github_accounts else None
    
    github_data = None
    if github_account:
        github_data = {
            "username": github_account.username,
            "github_user_id": github_account.github_user_id
        }
        
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "github": github_data
    }

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Logout")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Destroys the authentication session."""
    session_id = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if session_id:
        await redis_client.delete(f"session:{session_id}")
    
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="lax"
    )
    return None

