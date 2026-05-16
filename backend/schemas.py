from pydantic import BaseModel
from datetime import datetime, date as DateType
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
    meeting_date: Optional[DateType] = None

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    meeting_date: Optional[DateType] = None
    tags: Optional[str] = None

class TranscribeRequest(BaseModel):
    language: str = 'en'

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
    meeting_date: Optional[DateType] = None
    duration_seconds: Optional[float] = None
    user_id: Optional[int] = None
    action_items: Optional[str] = None
    tags: Optional[str] = None
    language: Optional[str] = None

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

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

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
