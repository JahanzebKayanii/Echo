from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None

class MeetingNotesUpdate(BaseModel):
    notes: str

class MeetingResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    audio_path: Optional[str]
    notes: Optional[str]
    summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class TranscriptUpdate(BaseModel):
    edited_text: Optional[str] = None

class RenameSpeakerRequest(BaseModel):
    old_name: str
    new_name: str

class TranscriptResponse(BaseModel):
    id: int
    meeting_id: int
    speaker: str
    speaker_label: Optional[str]
    text: str
    edited_text: Optional[str]
    start_time: float
    end_time: float

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    id: int
    meeting_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
