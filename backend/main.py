from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import engine, get_db, SessionLocal
from datetime import datetime, timedelta, timezone
from auth import hash_password, verify_password, create_access_token, get_current_user, generate_token
import resend
from deepgram import DeepgramClient, PrerecordedOptions
import anthropic
import os
import time
import io
import re
import json
import httpx
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import openpyxl

def format_time(seconds):
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m}:{s:02d}"

def build_transcript_text(transcripts):
    return "\n".join([
        f"{t.speaker_label or t.speaker} [{format_time(t.start_time)}]: {t.edited_text or t.text}"
        for t in transcripts
    ])

models.Base.metadata.create_all(bind=engine)

from sqlalchemy import text as _text
with engine.connect() as _conn:
    try:
        _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR"))
        _conn.commit()
    except Exception:
        pass

app = FastAPI(title="Echo API")

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

resend.api_key = os.getenv("RESEND_API_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def send_verification_email(to_email: str, token: str):
    link = f"{FRONTEND_URL}?verify={token}"
    resend.Emails.send({
        "from": "Echo <onboarding@resend.dev>",
        "to": [to_email],
        "subject": "Verify your Echo account",
        "html": f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#a78bfa;margin-bottom:8px;">Echo</h2>
            <p style="color:#334155;">Click below to verify your email address.</p>
            <a href="{link}" style="display:inline-block;margin:24px 0;background:#7c3aed;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Verify Email</a>
            <p style="color:#94a3b8;font-size:13px;">If you didn't create an Echo account, ignore this email.</p>
        </div>"""
    })

def send_reset_email(to_email: str, token: str):
    link = f"{FRONTEND_URL}?reset={token}"
    resend.Emails.send({
        "from": "Echo <onboarding@resend.dev>",
        "to": [to_email],
        "subject": "Reset your Echo password",
        "html": f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#a78bfa;margin-bottom:8px;">Echo</h2>
            <p style="color:#334155;">Click below to reset your password. This link expires in 30 minutes.</p>
            <a href="{link}" style="display:inline-block;margin:24px 0;background:#7c3aed;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
            <p style="color:#94a3b8;font-size:13px;">If you didn't request this, ignore this email.</p>
        </div>"""
    })

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Echo"}

@app.get("/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {"email": current_user.email, "is_pro": current_user.is_pro, "name": current_user.name or ""}

@app.post("/auth/register", response_model=schemas.UserResponse)
def register(body: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    token = generate_token()
    user = models.User(email=body.email, hashed_password=hash_password(body.password), verification_token=token, is_verified=False, name=body.name or None)
    db.add(user)
    db.commit()
    db.refresh(user)
    try:
        send_verification_email(body.email, token)
    except Exception as e:
        print(f"Verification email error: {e}")
    return user

@app.post("/auth/google", response_model=schemas.Token)
async def google_auth(body: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    import secrets
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {body.token}"}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    info = resp.json()
    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email in Google account")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            email=email,
            hashed_password=hash_password(secrets.token_hex(32)),
            is_verified=True,
            name=info.get("given_name") or info.get("name") or None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.is_verified:
        user.is_verified = True
        db.commit()

    return {"access_token": create_access_token(user.email), "token_type": "bearer"}

@app.post("/auth/github", response_model=schemas.Token)
async def github_auth(body: schemas.OAuthCodeRequest, db: Session = Depends(get_db)):
    import secrets
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={"client_id": client_id, "client_secret": client_secret, "code": body.code, "redirect_uri": body.redirect_uri},
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="GitHub auth failed")
        user_resp = await client.get("https://api.github.com/user", headers={"Authorization": f"Bearer {access_token}"})
        emails_resp = await client.get("https://api.github.com/user/emails", headers={"Authorization": f"Bearer {access_token}"})
    user_data = user_resp.json()
    email = next((e["email"] for e in emails_resp.json() if e.get("primary") and e.get("verified")), user_data.get("email"))
    if not email:
        raise HTTPException(status_code=400, detail="No email found in GitHub account")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(email=email, hashed_password=hash_password(secrets.token_hex(32)), is_verified=True, name=user_data.get("name") or user_data.get("login") or None)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.is_verified:
        user.is_verified = True
        db.commit()
    return {"access_token": create_access_token(user.email), "token_type": "bearer"}

@app.post("/auth/microsoft", response_model=schemas.Token)
async def microsoft_auth(body: schemas.OAuthCodeRequest, db: Session = Depends(get_db)):
    import secrets
    client_id = os.getenv("MICROSOFT_CLIENT_ID")
    client_secret = os.getenv("MICROSOFT_CLIENT_SECRET")
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            data={"client_id": client_id, "client_secret": client_secret, "code": body.code, "redirect_uri": body.redirect_uri, "grant_type": "authorization_code", "scope": "User.Read openid email profile"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Microsoft auth failed")
        user_resp = await client.get("https://graph.microsoft.com/v1.0/me", headers={"Authorization": f"Bearer {access_token}"})
    user_data = user_resp.json()
    email = user_data.get("mail") or user_data.get("userPrincipalName")
    if not email:
        raise HTTPException(status_code=400, detail="No email found in Microsoft account")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(email=email, hashed_password=hash_password(secrets.token_hex(32)), is_verified=True, name=user_data.get("givenName") or user_data.get("displayName") or None)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.is_verified:
        user.is_verified = True
        db.commit()
    return {"access_token": create_access_token(user.email), "token_type": "bearer"}

@app.post("/auth/login", response_model=schemas.Token)
def login(body: schemas.UserCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in. Check your inbox.")
    return {"access_token": create_access_token(user.email), "token_type": "bearer"}

@app.get("/auth/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
    user.is_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email verified successfully"}

@app.post("/auth/forgot-password")
def forgot_password(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if user:
        token = generate_token()
        user.reset_token = token
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        db.commit()
        try:
            send_reset_email(body.email, token)
        except Exception as e:
            print(f"Reset email error: {e}")
    return {"message": "If that email exists, a reset link has been sent."}

@app.post("/auth/reset-password")
def reset_password(body: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.reset_token == body.token).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    if datetime.now(timezone.utc) > user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Reset link has expired. Request a new one.")
    user.hashed_password = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"message": "Password reset successfully. You can now sign in."}

FREE_MEETING_LIMIT = 5
FREE_FILE_SIZE_LIMIT = 100 * 1024 * 1024   # 100 MB
FREE_DURATION_LIMIT = 2 * 3600              # 2 hours in seconds

@app.post("/meetings", response_model=schemas.MeetingResponse)
def create_meeting(meeting: schemas.MeetingCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    count = db.query(models.Meeting).filter(models.Meeting.user_id == current_user.id).count()
    if not current_user.is_pro and count >= FREE_MEETING_LIMIT:
        raise HTTPException(status_code=403, detail=f"Free plan limit reached ({FREE_MEETING_LIMIT} meetings). Delete a meeting to make room.")
    db_meeting = models.Meeting(**meeting.model_dump(), user_id=current_user.id)
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

@app.delete("/auth/account")
def delete_account(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting_ids = [m.id for m in db.query(models.Meeting.id).filter(models.Meeting.user_id == current_user.id)]
    if meeting_ids:
        db.query(models.ChatMessage).filter(models.ChatMessage.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(models.Transcript).filter(models.Transcript.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(models.Meeting).filter(models.Meeting.user_id == current_user.id).delete(synchronize_session=False)
        db.flush()
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted"}

@app.get("/meetings", response_model=List[schemas.MeetingResponse])
def list_meetings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Meeting).filter(models.Meeting.user_id == current_user.id).order_by(models.Meeting.created_at.desc()).all()

@app.get("/meetings/{meeting_id}", response_model=schemas.MeetingResponse)
def get_meeting(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

@app.delete("/meetings/{meeting_id}")
def delete_meeting(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    try:
        db.query(models.ChatMessage).filter(models.ChatMessage.meeting_id == meeting_id).delete(synchronize_session=False)
        db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).delete(synchronize_session=False)
        db.flush()
        db.delete(meeting)
        db.commit()
        print(f"Deleted meeting {meeting_id} successfully")
        return {"message": "Meeting deleted"}
    except Exception as e:
        db.rollback()
        print(f"Delete error for meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/meetings/{meeting_id}/audio", response_model=schemas.MeetingResponse)
async def upload_audio(meeting_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    os.makedirs("uploads", exist_ok=True)
    ext = file.filename.split(".")[-1] if "." in file.filename else "webm"
    filename = f"{meeting_id}_{int(time.time())}.{ext}"
    filepath = os.path.join("uploads", filename)

    content = await file.read()
    if not current_user.is_pro and len(content) > FREE_FILE_SIZE_LIMIT:
        raise HTTPException(status_code=413, detail="File exceeds the 100 MB free plan limit. Upgrade to Pro for larger files.")
    with open(filepath, "wb") as f:
        f.write(content)

    meeting.audio_path = filepath
    meeting.status = "processing"
    db.commit()
    db.refresh(meeting)
    return meeting

def run_transcription(filepath: str, meeting_id: int, is_pro: bool = False, language: str = 'en'):
    db = SessionLocal()
    try:
        deepgram = DeepgramClient(os.getenv("DEEPGRAM_API_KEY"))

        with open(filepath, "rb") as f:
            buffer_data = f.read()

        options = PrerecordedOptions(
            model="nova-2",
            diarize=True,
            punctuate=True,
            utterances=True,
            language=language,
        )

        response = deepgram.listen.rest.v("1").transcribe_file(
            {"buffer": buffer_data},
            options,
            timeout=httpx.Timeout(300.0, connect=10.0),
        )

        utterances = response.results.utterances or []
        for u in utterances:
            segment = models.Transcript(
                meeting_id=meeting_id,
                speaker=f"Speaker {u.speaker}",
                text=u.transcript,
                start_time=u.start,
                end_time=u.end,
            )
            db.add(segment)

        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if meeting:
            if utterances:
                duration = max(u.end for u in utterances)
                if not is_pro and duration > FREE_DURATION_LIMIT:
                    meeting.status = "error"
                    meeting.summary = f"Recording is {round(duration/3600, 1)}h — free plan limit is 2 hours. Upgrade to Pro for unlimited duration."
                    db.commit()
                    return
                meeting.duration_seconds = duration
            meeting.status = "completed"
        db.commit()

    except Exception as e:
        print(f"Transcription error: {e}")
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if meeting:
            meeting.status = "error"
        db.commit()
    finally:
        db.close()

@app.post("/meetings/{meeting_id}/transcribe")
def transcribe_meeting(meeting_id: int, body: schemas.TranscribeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not meeting.audio_path:
        raise HTTPException(status_code=400, detail="No audio uploaded yet")

    meeting.language = body.language
    db.commit()
    background_tasks.add_task(run_transcription, meeting.audio_path, meeting_id, current_user.is_pro, body.language)
    return {"message": "Transcription started"}

@app.get("/meetings/{meeting_id}/transcripts", response_model=List[schemas.TranscriptResponse])
def get_transcripts(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return (
        db.query(models.Transcript)
        .filter(models.Transcript.meeting_id == meeting_id)
        .order_by(models.Transcript.start_time)
        .all()
    )

@app.patch("/transcripts/{transcript_id}", response_model=schemas.TranscriptResponse)
def update_transcript(transcript_id: int, body: schemas.TranscriptUpdate, db: Session = Depends(get_db)):
    transcript = db.query(models.Transcript).filter(models.Transcript.id == transcript_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    if body.edited_text is not None:
        transcript.edited_text = body.edited_text
    db.commit()
    db.refresh(transcript)
    return transcript

@app.patch("/meetings/{meeting_id}", response_model=schemas.MeetingResponse)
def update_meeting(meeting_id: int, body: schemas.MeetingUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if body.title is not None:
        meeting.title = body.title
    if body.description is not None:
        meeting.description = body.description
    if body.meeting_date is not None:
        meeting.meeting_date = body.meeting_date
    if body.tags is not None:
        meeting.tags = body.tags
    db.commit()
    db.refresh(meeting)
    return meeting

@app.patch("/meetings/{meeting_id}/notes", response_model=schemas.MeetingResponse)
def update_notes(meeting_id: int, body: schemas.MeetingNotesUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting.notes = body.notes
    db.commit()
    db.refresh(meeting)
    return meeting

@app.post("/meetings/{meeting_id}/rename-speaker")
def rename_speaker(meeting_id: int, body: schemas.RenameSpeakerRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    transcripts = db.query(models.Transcript).filter(
        models.Transcript.meeting_id == meeting_id
    ).all()
    for t in transcripts:
        current = t.speaker_label or t.speaker
        if current == body.old_name:
            t.speaker_label = body.new_name
    db.commit()
    return {"message": "Speaker renamed"}

@app.post("/meetings/{meeting_id}/reset-speakers")
def reset_speakers(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).update(
        {"speaker_label": None}, synchronize_session=False
    )
    db.commit()
    return {"message": "Speakers reset"}

@app.post("/meetings/{meeting_id}/identify-speakers")
def identify_speakers(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcripts = db.query(models.Transcript).filter(
        models.Transcript.meeting_id == meeting_id
    ).order_by(models.Transcript.start_time).all()

    if not transcripts:
        raise HTTPException(status_code=400, detail="No transcript available")

    transcript_text = build_transcript_text(transcripts)
    unique_speakers = list(dict.fromkeys(t.speaker_label or t.speaker for t in transcripts))

    client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": (
                f"Transcript (speaker labels: {', '.join(unique_speakers)}):\n\n{transcript_text}\n\n"
                "Look through this transcript and figure out the real name of each speaker where it's reasonably clear. "
                "Use introductions, self-introductions, being addressed by name, or context. "
                "One important rule: if a speaker refers to someone in third person ('Paul is the manager, he called this meeting') "
                "that speaker is NOT Paul — they are describing someone else. "
                "Don't assign role labels like Narrator or Host, only real names. "
                f"Use EXACTLY these label strings in old_name: {', '.join(unique_speakers)}. "
                "Return ONLY a JSON array: [{\"old_name\": \"Speaker 0\", \"new_name\": \"David\"}, ...]. "
                "If no names are clear, return []."
            )
        }]
    )

    raw = response.content[0].text.strip()
    print(f"[identify-speakers] Claude raw response: {raw}")
    try:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        mappings = json.loads(match.group(0)) if match else []
        if not isinstance(mappings, list):
            mappings = []
    except Exception as e:
        print(f"[identify-speakers] JSON parse error: {e}")
        mappings = []

    print(f"[identify-speakers] Parsed mappings: {mappings}")

    applied = 0
    for mapping in mappings:
        old = (mapping.get("old_name") or "").strip()
        new = (mapping.get("new_name") or "").strip()
        if old and new and old != new:
            renamed = False
            for t in transcripts:
                current = (t.speaker_label or t.speaker).strip()
                if current.lower() == old.lower():
                    t.speaker_label = new
                    renamed = True
            if renamed:
                applied += 1

    db.commit()
    return {"count": applied, "mappings": mappings}

@app.post("/meetings/{meeting_id}/summarize", response_model=schemas.MeetingResponse)
def summarize_meeting(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcripts = db.query(models.Transcript).filter(
        models.Transcript.meeting_id == meeting_id
    ).order_by(models.Transcript.start_time).all()

    if not transcripts:
        raise HTTPException(status_code=400, detail="No transcript available")

    transcript_text = build_transcript_text(transcripts)

    client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"Provide a concise summary of this meeting. Include: main topics discussed, key decisions, and action items if any.\n\nTranscript:\n{transcript_text}"
        }]
    )

    meeting.summary = response.content[0].text
    db.commit()
    db.refresh(meeting)
    return meeting

@app.post("/meetings/{meeting_id}/action-items", response_model=schemas.MeetingResponse)
def extract_action_items(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcripts = db.query(models.Transcript).filter(
        models.Transcript.meeting_id == meeting_id
    ).order_by(models.Transcript.start_time).all()

    if not transcripts:
        raise HTTPException(status_code=400, detail="No transcript available")

    transcript_text = build_transcript_text(transcripts)

    client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                "Extract all action items from this meeting transcript. "
                "For each action item return a JSON object with: "
                "\"person\" (who is responsible, or \"Unassigned\"), "
                "\"task\" (what needs to be done), "
                "\"deadline\" (when, or null if not mentioned). "
                "Return ONLY a valid JSON array, no other text.\n\n"
                f"Transcript:\n{transcript_text}"
            )
        }]
    )

    meeting.action_items = response.content[0].text.strip()
    db.commit()
    db.refresh(meeting)
    return meeting

@app.post("/meetings/{meeting_id}/chat")
def chat_with_meeting(meeting_id: int, body: schemas.ChatRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcripts = db.query(models.Transcript).filter(
        models.Transcript.meeting_id == meeting_id
    ).order_by(models.Transcript.start_time).all()

    transcript_text = build_transcript_text(transcripts)

    history = db.query(models.ChatMessage).filter(
        models.ChatMessage.meeting_id == meeting_id
    ).order_by(models.ChatMessage.created_at).all()

    user_msg = models.ChatMessage(meeting_id=meeting_id, role="user", content=body.message)
    db.add(user_msg)
    db.commit()

    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": body.message})

    client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=f"You are an AI assistant analyzing a meeting transcript. Answer questions based on the transcript only.\n\nTranscript:\n{transcript_text}",
        messages=messages
    )

    ai_text = response.content[0].text
    assistant_msg = models.ChatMessage(meeting_id=meeting_id, role="assistant", content=ai_text)
    db.add(assistant_msg)
    db.commit()

    return {"response": ai_text}

@app.get("/meetings/{meeting_id}/chat", response_model=List[schemas.ChatMessageResponse])
def get_chat_history(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.ChatMessage).filter(
        models.ChatMessage.meeting_id == meeting_id
    ).order_by(models.ChatMessage.created_at).all()

@app.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    total_meetings = db.query(models.Meeting).filter(models.Meeting.user_id == current_user.id).count()
    meeting_ids = [m.id for m in db.query(models.Meeting.id).filter(models.Meeting.user_id == current_user.id)]
    transcripts = db.query(models.Transcript).filter(models.Transcript.meeting_id.in_(meeting_ids)).all()
    total_seconds = sum((t.end_time - t.start_time) for t in transcripts)
    total_hours = round(total_seconds / 3600, 1)
    return {
        "total_meetings": total_meetings,
        "total_hours": total_hours,
        "meeting_limit": FREE_MEETING_LIMIT,
        "is_pro": current_user.is_pro,
    }

@app.get("/meetings/search/query", response_model=List[schemas.MeetingResponse])
def search_meetings(q: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    pattern = f"%{q}%"
    by_title = db.query(models.Meeting).filter(
        models.Meeting.user_id == current_user.id,
        models.Meeting.title.ilike(pattern) | models.Meeting.description.ilike(pattern)
    ).all()
    transcript_ids = db.query(models.Transcript.meeting_id).filter(
        models.Transcript.text.ilike(pattern) | models.Transcript.edited_text.ilike(pattern)
    ).subquery()
    by_transcript = db.query(models.Meeting).filter(
        models.Meeting.user_id == current_user.id,
        models.Meeting.id.in_(transcript_ids)
    ).all()
    seen = set()
    results = []
    for m in by_title + by_transcript:
        if m.id not in seen:
            seen.add(m.id)
            results.append(m)
    results.sort(key=lambda m: m.created_at, reverse=True)
    return results

def markdown_to_reportlab(text, styles):
    bullet_style = ParagraphStyle('bullet', parent=styles['Normal'],
        leftIndent=20, spaceAfter=4, textColor=colors.HexColor('#1a1a2e'))
    elements = []
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            elements.append(Spacer(1, 6))
            continue
        line = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', line)
        line = re.sub(r'\*(.+?)\*', r'<i>\1</i>', line)
        if line.startswith('### '):
            elements.append(Paragraph(line[4:], styles['Heading3']))
        elif line.startswith('## '):
            elements.append(Paragraph(line[3:], styles['Heading2']))
        elif line.startswith('# '):
            elements.append(Paragraph(line[2:], styles['Heading1']))
        elif line.startswith(('* ', '- ')):
            elements.append(Paragraph(f'• {line[2:]}', bullet_style))
        else:
            elements.append(Paragraph(line, styles['Normal']))
        elements.append(Spacer(1, 4))
    return elements

@app.get("/meetings/{meeting_id}/export/pdf")
def export_pdf(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    transcripts = db.query(models.Transcript).filter(
        models.Transcript.meeting_id == meeting_id
    ).order_by(models.Transcript.start_time).all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter)
    styles = getSampleStyleSheet()
    watermark_style = ParagraphStyle('watermark', parent=styles['Normal'],
        textColor=colors.HexColor('#cccccc'), fontSize=8)
    story = []

    story.append(Paragraph(meeting.title, styles['Title']))
    story.append(Spacer(1, 12))
    if meeting.description:
        story.append(Paragraph(meeting.description, styles['Normal']))
        story.append(Spacer(1, 12))

    if meeting.summary:
        story.append(Paragraph("AI Summary", styles['Heading2']))
        story.extend(markdown_to_reportlab(meeting.summary, styles))
        story.append(Spacer(1, 12))

    if transcripts:
        story.append(Paragraph("Transcript", styles['Heading2']))
        for t in transcripts:
            speaker = t.speaker_label or t.speaker
            text = t.edited_text or t.text
            story.append(Paragraph(f"<b>{speaker} [{format_time(t.start_time)}]:</b> {text}", styles['Normal']))
            story.append(Spacer(1, 4))

    story.append(Spacer(1, 24))
    story.append(Paragraph("Generated by Echo AI", watermark_style))
    doc.build(story)
    buf.seek(0)

    safe_title = "".join(c for c in meeting.title if c.isalnum() or c in " -_")
    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'})

@app.get("/meetings/{meeting_id}/export/excel")
def export_excel(meeting_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id, models.Meeting.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    transcripts = db.query(models.Transcript).filter(
        models.Transcript.meeting_id == meeting_id
    ).order_by(models.Transcript.start_time).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Transcript"

    ws.append(["Echo AI Export", "", "", ""])
    ws.append(["Meeting:", meeting.title, "", ""])
    if meeting.description:
        ws.append(["Description:", meeting.description, "", ""])
    ws.append([])

    if meeting.summary:
        ws.append(["AI Summary"])
        ws.append([meeting.summary])
        ws.append([])

    ws.append(["Speaker", "Start Time", "End Time", "Text"])
    for t in transcripts:
        ws.append([
            t.speaker_label or t.speaker,
            format_time(t.start_time),
            format_time(t.end_time),
            t.edited_text or t.text,
        ])

    ws.append([])
    ws.append(["Generated by Echo AI"])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    safe_title = "".join(c for c in meeting.title if c.isalnum() or c in " -_")
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.xlsx"'})
