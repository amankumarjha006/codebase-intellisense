from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.repositories.user import UserAccountRepository
from app.core.encryption import encrypt_token

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserAccountRepository(db)

    def provision_user_and_installation(
        self,
        github_user_data: Dict[str, Any],
        access_token: str,
        verified_installation: Optional[Dict[str, Any]],
        installation_id: Optional[str]
    ) -> Any:
        """
        Provisions or updates a user, their GitHub account, and installation.
        Handles the transaction boundary.
        """
        github_user_id = github_user_data["github_user_id"]
        username = github_user_data["username"]
        email = github_user_data["email"]
        full_name = github_user_data["full_name"]
        
        try:
            encrypted_token = encrypt_token(access_token)
            
            github_account = self.user_repo.get_github_account_by_github_user_id(github_user_id)
            
            if github_account:
                user = github_account.user
                user.email = email
                user.full_name = full_name
                github_account.username = username
                github_account.access_token_encrypted = encrypted_token
            else:
                user = self.user_repo.get_user_by_email(email)
                if not user:
                    user = self.user_repo.create_user(email=email, full_name=full_name)
                    
                github_account = self.user_repo.create_github_account(
                    user_id=user.id,
                    github_user_id=github_user_id,
                    username=username,
                    access_token_encrypted=encrypted_token
                )

            if verified_installation and installation_id:
                target_type = verified_installation.get("target_type", "Unknown")
                installation = self.user_repo.get_installation_by_installation_id(installation_id)
                
                if installation:
                    installation.github_account_id = github_account.id
                    installation.target_type = target_type
                else:
                    self.user_repo.create_installation(
                        github_account_id=github_account.id,
                        installation_id=installation_id,
                        target_type=target_type
                    )
            
            self.db.commit()
            return user
        except Exception:
            self.db.rollback()
            raise
