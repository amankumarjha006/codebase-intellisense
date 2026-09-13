from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session

from app.models.user import User, GithubAccount, GithubInstallation

class UserAccountRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_github_account_by_github_user_id(self, github_user_id: str) -> Optional[GithubAccount]:
        return self.db.query(GithubAccount).filter(GithubAccount.github_user_id == github_user_id).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_installation_by_installation_id(self, installation_id: str) -> Optional[GithubInstallation]:
        return self.db.query(GithubInstallation).filter(GithubInstallation.installation_id == installation_id).first()

    def create_user(self, *, email: str, full_name: str) -> User:
        user = User(email=email, full_name=full_name)
        self.db.add(user)
        self.db.flush()
        return user

    def create_github_account(
        self, *, user_id: UUID, github_user_id: str, username: str, access_token_encrypted: str
    ) -> GithubAccount:
        account = GithubAccount(
            user_id=user_id,
            github_user_id=github_user_id,
            username=username,
            access_token_encrypted=access_token_encrypted
        )
        self.db.add(account)
        self.db.flush()
        return account

    def create_installation(
        self, *, github_account_id: UUID, installation_id: str, target_type: str
    ) -> GithubInstallation:
        installation = GithubInstallation(
            github_account_id=github_account_id,
            installation_id=installation_id,
            target_type=target_type
        )
        self.db.add(installation)
        self.db.flush()
        return installation
