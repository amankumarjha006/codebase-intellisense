from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional

class GithubIdentityOut(BaseModel):
    username: str
    github_user_id: str

class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    github: GithubIdentityOut
