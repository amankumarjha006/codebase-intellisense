from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class ConversationCreate(BaseModel):
    title: str | None = Field(None, max_length=512)

class ConversationOut(BaseModel):
    id: UUID
    repository_id: UUID
    user_id: UUID
    repository_version_id: UUID
    title: str | None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ConversationListOut(BaseModel):
    items: list[ConversationOut]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    limit: int = Field(ge=1, le=100)
    has_more: bool

class MessageCreate(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str

class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class MessageListOut(BaseModel):
    items: list[MessageOut]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    limit: int = Field(ge=1, le=100)
    has_more: bool
