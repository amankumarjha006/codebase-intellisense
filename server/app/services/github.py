import httpx
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class GithubAuthError(Exception):
    """Exception raised for GitHub API errors during authentication."""
    pass

class GithubService:
    def __init__(self):
        self.client_id = settings.GITHUB_CLIENT_ID
        self.client_secret = settings.GITHUB_CLIENT_SECRET
        self.callback_url = settings.GITHUB_CALLBACK_URL

    def get_authorization_url(self, state: str) -> str:
        """Construct the GitHub App user authorization URL."""
        if not self.client_id:
            raise ValueError("GITHUB_CLIENT_ID is not configured.")
            
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.callback_url,
            "state": state,
            # For GitHub Apps, we generally don't need to request scopes for user-to-server 
            # if we are just identifying the user, but we might want user:email to ensure 
            # we can read the email address if it's private.
        }
        query_string = urlencode(params)
        return f"https://github.com/login/oauth/authorize?{query_string}"

    async def exchange_code_for_token(self, code: str) -> str:
        """Exchange the authorization code for a User Access Token."""
        if not self.client_id or not self.client_secret:
            raise ValueError("GitHub credentials not fully configured.")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.callback_url,
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                logger.error("GitHub token exchange failed with status %s", response.status_code)
                raise GithubAuthError("Failed to exchange authorization code.")
                
            data = response.json()
            if "error" in data:
                logger.error(
                    "GitHub returned an error during code exchange: %s", data.get("error")
                )
                raise GithubAuthError(data.get("error_description", data.get("error")))
                
            return data["access_token"]

    async def get_authenticated_user(self, access_token: str) -> Dict[str, Any]:
        """
        Fetch the authenticated GitHub user's profile and explicitly find their primary email.
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        async with httpx.AsyncClient() as client:
            # 1. Get basic profile
            profile_resp = await client.get("https://api.github.com/user", headers=headers, timeout=10.0)
            if profile_resp.status_code != 200:
                logger.error(
                    "Failed to fetch GitHub user profile with status %s", profile_resp.status_code
                )
                raise GithubAuthError("Failed to retrieve user profile from GitHub.")
                
            profile = profile_resp.json()
            
            # 2. Get verified primary email
            emails_resp = await client.get("https://api.github.com/user/emails", headers=headers, timeout=10.0)
            if emails_resp.status_code != 200:
                logger.error(
                    "Failed to fetch GitHub user emails with status %s", emails_resp.status_code
                )
                raise GithubAuthError("Failed to retrieve user emails from GitHub.")
                
            emails = emails_resp.json()
            primary_email = None
            
            # Find primary and verified email
            for email_obj in emails:
                if email_obj.get("primary") and email_obj.get("verified"):
                    primary_email = email_obj.get("email")
                    break
            
            # Fallback to any verified email if no primary verified is found
            if not primary_email:
                for email_obj in emails:
                    if email_obj.get("verified"):
                        primary_email = email_obj.get("email")
                        break
                        
            if not primary_email:
                raise GithubAuthError("No verified email address found on your GitHub account.")
                
            return {
                "github_user_id": str(profile["id"]),
                "username": profile["login"],
                "full_name": profile.get("name") or profile["login"],
                "email": primary_email
            }

    async def verify_user_installation(self, access_token: str, installation_id: str) -> Optional[Dict[str, Any]]:
        """
        Verify that the given installation_id belongs to an installation accessible by the authenticated user.
        Returns the installation details if verified, else None.
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/installations", 
                headers=headers, 
                params={"per_page": 100},
                timeout=10.0
            )
            
            if resp.status_code != 200:
                logger.error(f"Failed to fetch user installations: {resp.text}")
                return None
                
            data = resp.json()
            installations = data.get("installations", [])
            
            for inst in installations:
                if str(inst.get("id")) == str(installation_id):
                    return inst
                    
            return None
