from fastapi import APIRouter, Depends, Request, Response, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import redis.asyncio as redis
import secrets
import logging
from typing import Optional

from app.core.config import settings
from app.api.deps import get_db, get_redis, get_current_user, AuthException
from app.services.github import GithubService, GithubAuthError
from app.models.user import User, GithubAccount, GithubInstallation
from app.schemas.auth import UserOut

logger = logging.getLogger(__name__)
router = APIRouter()
github_service = GithubService()

@router.get("/github", summary="Initiate GitHub App Authorization")
async def login_github(redis_client: redis.Redis = Depends(get_redis)):
    """Initiates the GitHub App user authorization flow."""
    # Generate random CSRF state
    state = secrets.token_urlsafe(32)
    
    # Store state in Redis with 10 minute expiration
    state_key = f"oauth_state:{state}"
    await redis_client.setex(state_key, 600, "1")
    
    # Construct authorization URL
    auth_url = github_service.get_authorization_url(state)
    return RedirectResponse(url=auth_url, status_code=302)

@router.get("/github/callback", summary="GitHub Auth Callback")
async def github_callback(
    request: Request,
    response: Response,
    code: str = Query(..., description="Authorization code from GitHub"),
    state: str = Query(..., description="CSRF state token"),
    installation_id: Optional[str] = Query(None, description="GitHub App Installation ID"),
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Handles the GitHub code exchange, provisions the user, and issues a session cookie."""
    # 1. Validate State
    state_key = f"oauth_state:{state}"
    # Atomic get and delete
    state_value = await redis_client.getdel(state_key)
    
    if not state_value:
        logger.warning("Invalid or expired OAuth state token.")
        # According to ERROR_CONTRACT, 400 Bad Request
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Invalid or expired authorization state."
                }
            }
        )
        
    try:
        # 2. Exchange code for access token
        access_token = await github_service.exchange_code_for_token(code)
        
        # 3. Resolve authenticated GitHub user
        github_user_data = await github_service.get_authenticated_user(access_token)
        
        github_user_id = github_user_data["github_user_id"]
        username = github_user_data["username"]
        email = github_user_data["email"]
        full_name = github_user_data["full_name"]
        
        # 4. Installation verification (Network Call)
        verified_installation = None
        if installation_id:
            verified_installation = await github_service.verify_user_installation(access_token, installation_id)
            if not verified_installation:
                logger.warning(f"Installation ID {installation_id} could not be verified for user {username}")
                # We do not provision this installation
        
        # 5. Provisioning Transaction (Database operations)
        # We start by querying the database, no flush is needed until the end.
        github_account = db.query(GithubAccount).filter(GithubAccount.github_user_id == github_user_id).first()
        
        from app.core.encryption import encrypt_token
        encrypted_token = encrypt_token(access_token)
        
        if github_account:
            # Update existing user and account
            user = github_account.user
            user.email = email
            user.full_name = full_name
            github_account.username = username
            github_account.access_token_encrypted = encrypted_token
        else:
            # Check if user with email already exists
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(email=email, full_name=full_name)
                db.add(user)
                # Flush is fine here because we are ALREADY past all network requests,
                # meaning the transaction is brief and won't hang on an API call.
                db.flush() 
                
            github_account = GithubAccount(
                user_id=user.id,
                github_user_id=github_user_id,
                username=username,
                access_token_encrypted=encrypted_token
            )
            db.add(github_account)
            db.flush()
            
        # 6. Provision installation if verified
        if verified_installation:
            # Target type should be extracted from GitHub's verified response
            # 'target_type' might be 'Organization' or 'User' typically.
            # We fallback to 'Unknown' just in case.
            target_type = verified_installation.get("target_type", "Unknown")
            
            installation = db.query(GithubInstallation).filter(
                GithubInstallation.installation_id == installation_id
            ).first()
            
            if installation:
                installation.github_account_id = github_account.id
                installation.target_type = target_type
            else:
                installation = GithubInstallation(
                    github_account_id=github_account.id,
                    installation_id=installation_id,
                    target_type=target_type
                )
                db.add(installation)

        db.commit()
        
        # 6. Create application authentication session
        session_id = secrets.token_urlsafe(32)
        await redis_client.setex(
            f"session:{session_id}", 
            settings.SESSION_EXPIRE_SECONDS, 
            str(user.id)
        )
        
        # 7. Redirect to frontend with HTTP-only cookie
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
        return redirect_response

    except GithubAuthError as e:
        db.rollback()
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
        db.rollback()
        logger.exception("Unexpected error during GitHub callback")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred during authentication."
                }
            }
        )

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

from fastapi.responses import JSONResponse
