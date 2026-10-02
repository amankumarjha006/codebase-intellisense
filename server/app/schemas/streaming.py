from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from app.schemas.message import MessageCitationOut

class MessageStartEvent(BaseModel):
    message_id: UUID
    conversation_id: UUID
    repository_version_id: UUID

class TokenEvent(BaseModel):
    text: str

class MessageCompleteEvent(BaseModel):
    message_id: UUID
    conversation_id: UUID
    repository_version_id: UUID

class ErrorEvent(BaseModel):
    code: str
    message: str
