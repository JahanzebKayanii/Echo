import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import RecordButton from './RecordButton'
import TranscriptLine from './TranscriptLine'
import ChatPanel from './ChatPanel'
import { apiFetch, API, getToken } from '../api'

const SPEAKER_COLORS = ['#a78bfa', '#34d399', '#f472b6', '#60a5fa', '#fb923c']

function colorForSpeaker(speaker) {
  const digits = speaker.replace(/\D/g, '')
  const index = digits ? parseInt(digits) % SPEAKER_COLORS.length : 0
  return SPEAKER_COLORS[index]
}

export default function MeetingDetail({ meeting, onBack, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(!!meeting.audio_path)
  const [transcribing, setTranscribing] = useState(false)
  const [transcripts, setTranscripts] = useState([])
  const [currentMeeting, setCurrentMeeting] = useState(meeting)
  const [notes, setNotes] = useState(meeting.notes || '')
  const [summarizing, setSummarizing] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (meeting.audio_path) fetchTranscripts()
    return () => clearInterval(pollRef.current)
  }, [])

  async function fetchTranscripts() {
    const res = await apiFetch(`/meetings/${meeting.id}/transcripts`)
    const data = await res.json()
    setTranscripts(data)
    return data
  }

  async function fetchMeeting() {
    const res = await apiFetch(`/meetings/${meeting.id}`)
    const data = await res.json()
    setCurrentMeeting(data)
    onUpdate(data)
    return data
  }

  async function uploadAudio(blob, filename) {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', blob, filename)
    const res = await apiFetch(`/meetings/${meeting.id}/audio`, {
      method: 'POST',
      body: formData,
    })
    const updated = await res.json()
    setUploading(false)
    setUploaded(true)
    setCurrentMeeting(updated)
    onUpdate(updated)
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    await uploadAudio(file, file.name)
  }

  async function startTranscription() {
    setTranscribing(true)
    await apiFetch(`/meetings/${meeting.id}/transcribe`, { method: 'POST' })
    pollRef.current = setInterval(async () => {
      const m = await fetchMeeting()
      if (m.status === 'completed' || m.status === 'error') {
        clearInterval(pollRef.current)
        setTranscribing(false)
        await fetchTranscripts()
      }
    }, 3000)
  }

  async function handleRenameSpeaker(oldName, newName) {
    await apiFetch(`/meetings/${meeting.id}/rename-speaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_name: oldName, new_name: newName }),
    })
    await fetchTranscripts()
  }

  async function generateSummary() {
    setSummarizing(true)
    const res = await apiFetch(`/meetings/${meeting.id}/summarize`, { method: 'POST' })
    const updated = await res.json()
    setCurrentMeeting(updated)
    onUpdate(updated)
    setSummarizing(false)
  }

  async function downloadExport(format) {
    const res = await apiFetch(`/meetings/${meeting.id}/export/${format}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentMeeting.title}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveNotes() {
    const updated = await apiFetch(`/meetings/${meeting.id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).then(r => r.json())
    setCurrentMeeting(updated)
    onUpdate(updated)
  }

  return (
    <div className="detail-view">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className="detail-header">
        <h2>{currentMeeting.title}</h2>
        {currentMeeting.description && <p className="detail-desc">{currentMeeting.description}</p>}
        <span className={`status-badge status-${currentMeeting.status}`}>
          {currentMeeting.status}
        </span>
      </div>

      <div className="audio-section">
        <h3>Audio</h3>
        {uploaded ? (
          <div className="audio-done">Audio saved.</div>
        ) : (
          <div className="audio-options">
            <RecordButton onRecordingComplete={uploadAudio} disabled={uploading} />
            <div className="or-divider">or</div>
            <label className="upload-label">
              Upload Audio File (.mp3, .wav, .m4a, .mp4)
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.webm,.mp4"
                onChange={handleFileUpload}
                hidden
              />
            </label>
            {uploading && <p className="uploading-text">Uploading audio...</p>}
          </div>
        )}
      </div>

      {uploaded && transcripts.length === 0 && (
        <div className="transcribe-section">
          <h3>Transcript</h3>
          {transcribing ? (
            <div className="transcribing-status">
              <span className="spinner" />
              Transcribing — this takes about 30–60 seconds...
            </div>
          ) : (
            <button className="transcribe-btn" onClick={startTranscription}>
              Transcribe Audio
            </button>
          )}
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="transcript-section">
          <h3>Transcript</h3>
          <p className="edit-instructions">Click any speaker name to rename · Click any line to edit text</p>
          <ul className="transcript-list">
            {transcripts.map(t => (
              <TranscriptLine
                key={t.id}
                transcript={t}
                color={colorForSpeaker(t.speaker_label || t.speaker)}
                onRenameSpeaker={handleRenameSpeaker}
                onTextSaved={fetchTranscripts}
              />
            ))}
          </ul>
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="summary-section">
          <h3>AI Summary</h3>
          {currentMeeting.summary ? (
            <div className="summary-text">
            <ReactMarkdown>{currentMeeting.summary}</ReactMarkdown>
          </div>
          ) : (
            <button className="summarize-btn" onClick={generateSummary} disabled={summarizing}>
              {summarizing ? <><span className="spinner" /> Generating summary...</> : 'Generate Summary'}
            </button>
          )}
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="chat-section">
          <h3>Ask Echo AI</h3>
          <ChatPanel meetingId={meeting.id} />
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="notes-section">
          <h3>Meeting Notes</h3>
          <textarea
            className="notes-input"
            placeholder="Add notes about this meeting..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={5}
          />
          <p className="notes-hint">Auto-saves when you click away</p>
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="export-section">
          <h3>Export</h3>
          <div className="export-buttons">
            <button className="export-btn" onClick={() => downloadExport('pdf')}>Download PDF</button>
            <button className="export-btn export-btn-excel" onClick={() => downloadExport('excel')}>Download Excel</button>
          </div>
        </div>
      )}
    </div>
  )
}
