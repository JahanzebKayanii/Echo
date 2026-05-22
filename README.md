# Echo — AI Meeting Intelligence Platform

Echo is a full-stack web application that records, transcribes, and analyses meetings using AI. Upload an audio file or record directly in the browser (or via the Chrome extension), and Echo produces a full transcript with speaker identification, an AI-generated summary, action items, and a conversational chat interface over the meeting content.

**Live demo:** https://echo-silk-one.vercel.app

---

## Features

- **Audio upload & in-browser recording** — upload any audio file or record directly from the microphone
- **Chrome extension** — record any meeting (Zoom, Teams, Google Meet, etc.) without leaving the browser
- **Speaker diarisation** — automatically labels each speaker; rename them or use AI auto-identification
- **AI transcription** — powered by Deepgram Nova-2 with punctuation and utterance detection
- **AI summaries & action items** — Claude generates structured summaries and extracts tasks with owners and deadlines
- **Meeting chat** — ask questions about any meeting in natural language; Claude answers using the transcript as context
- **Tags & search** — tag meetings and full-text search across titles, descriptions, and transcripts
- **Export** — download transcripts and summaries as PDF or Excel
- **OAuth sign-in** — Google, GitHub, and Microsoft in addition to email/password

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (SQLAlchemy ORM) |
| Transcription | Deepgram Nova-2 |
| AI | Anthropic Claude (summaries, chat, speaker ID) |
| Auth | JWT + OAuth (Google, GitHub, Microsoft) |
| Deployment | Vercel (frontend), Render (backend + DB) |
| Extension | Chrome Manifest V3 |
| Export | ReportLab (PDF), openpyxl (Excel) |

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  React Frontend │────▶│  FastAPI Backend      │────▶│  PostgreSQL │
│  (Vercel)       │     │  (Render)             │     │  (Render)   │
└─────────────────┘     └──────────────────────┘     └─────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             Deepgram API   Anthropic API   Google/GitHub/
             (transcribe)   (summarise,     Microsoft OAuth
                             chat, AI ID)
```

The frontend is a single-page React app with no router — page state is managed via React state. The backend is a REST API using FastAPI with SQLAlchemy for the ORM. Transcription and AI tasks run as background jobs so the API stays responsive.

---

## Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL database

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://user:password@localhost/echo
SECRET_KEY=your-secret-key
DEEPGRAM_API_KEY=your-deepgram-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GITHUB_CLIENT_ID=your-github-client-id
VITE_MICROSOFT_CLIENT_ID=your-microsoft-client-id
```

```bash
npm run dev
```

### Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Sign into Echo in the browser — the extension picks up your session automatically

---

## Project Structure

```
Echo/
├── backend/
│   ├── main.py          # All API routes
│   ├── models.py        # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   ├── auth.py          # JWT + password hashing
│   ├── database.py      # DB connection
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx              # Main app + routing state
│       ├── components/
│       │   ├── MeetingDetail.jsx    # Transcript, summary, chat, export
│       │   ├── LoginPage.jsx        # Auth (email + OAuth)
│       │   ├── LandingPage.jsx      # Marketing page
│       │   ├── SettingsPage.jsx     # Account settings
│       │   └── Toast.jsx            # Notification system
│       └── api.js               # Fetch wrapper with auth
└── extension/
    ├── manifest.json    # Chrome MV3 config
    ├── popup.html/js    # Extension UI
    ├── recorder.html/js # Full-tab recording page
    ├── background.js    # Service worker
    └── content.js       # Auth token sync
```

---

## Key Implementation Details

**Speaker diarisation with AI identification** — Deepgram labels speakers numerically (`Speaker 0`, `Speaker 1`). A separate Claude call analyses the transcript and infers real names from introductions and context, applying them with one DB update per identified speaker.

**Streaming chat** — Meeting chat uses Claude's streaming API via Server-Sent Events, so responses appear word-by-word rather than after a full round-trip.

**Chrome extension auth** — The extension content script polls `localStorage` on the Echo web app every 2 seconds and writes the JWT to `chrome.storage.local`, so the extension popup stays in sync with the web app session without requiring a separate login.

**OAuth code flow** — GitHub and Microsoft use the standard authorisation code flow with the app origin as the redirect URI. The backend exchanges the code for an access token and fetches the user profile server-side, keeping client secrets out of the browser.
