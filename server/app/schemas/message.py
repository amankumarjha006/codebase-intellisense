from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime

class MessageCitationOut(BaseModel):
    id: UUID
    file_path: str
    start_line: int
    end_line: int

    model_config = ConfigDict(from_attributes=True)

class MessageOutWithCitations(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    created_at: datetime
    citations: list[MessageCitationOut]

    model_config = ConfigDict(from_attributes=True)

class ConversationMessageRequest(BaseModel):
    content: str

class ConversationMessageResponse(BaseModel):
    user_message: MessageOutWithCitations
    assistant_message: MessageOutWithCitations
    repository_version_id: UUID
