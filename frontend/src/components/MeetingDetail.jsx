import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import RecordButton from './RecordButton'
import TranscriptLine from './TranscriptLine'
import ChatPanel from './ChatPanel'
import { apiFetch } from '../api'

const SPEAKER_COLORS = ['#a78bfa', '#34d399', '#f472b6', '#60a5fa', '#fb923c']

function colorForSpeaker(speaker) {
  const digits = speaker.replace(/\D/g, '')
  const index = digits ? parseInt(digits) % SPEAKER_COLORS.length : 0
  return SPEAKER_COLORS[index]
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function SectionHeader({ title, isOpen, onToggle, right }) {
  return (
    <button className="section-toggle" onClick={onToggle}>
      <span className="section-toggle-left">
        <span className={`section-chevron ${isOpen ? 'open' : ''}`}>›</span>
        {title}
      </span>
      {right && <span className="section-toggle-right">{right}</span>}
    </button>
  )
}

export default function MeetingDetail({ meeting, onBack, onUpdate, showToast = () => {} }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(!!meeting.audio_path)
  const [transcribing, setTranscribing] = useState(false)
  const [transcripts, setTranscripts] = useState([])
  const [currentMeeting, setCurrentMeeting] = useState(meeting)
  const [notes, setNotes] = useState(meeting.notes || '')
  const [summarizing, setSummarizing] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(meeting.title)
  const [openSections, setOpenSections] = useState({})
  const pollRef = useRef(null)

  useEffect(() => {
    if (meeting.audio_path) fetchTranscripts()
    if (meeting.status === 'processing') {
      setTranscribing(true)
      pollRef.current = setInterval(async () => {
        const m = await fetchMeeting()
        if (m.status === 'completed' || m.status === 'error') {
          clearInterval(pollRef.current)
          setTranscribing(false)
          await fetchTranscripts()
        }
      }, 3000)
    }
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !editingTitle) onBack() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingTitle, onBack])

  function toggleSection(name) {
    const isOpening = !openSections[name]
    setOpenSections(prev => ({ ...prev, [name]: !prev[name] }))
    if (isOpening) {
      if (name === 'summary' && !currentMeeting.summary && !summarizing) generateSummary()
      if (name === 'actions' && !currentMeeting.action_items && !extracting) extractActionItems()
    }
  }

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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast(err.detail || 'Upload failed.', 'error')
      setUploading(false)
      return
    }
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
    showToast('Summary generated')
  }

  async function extractActionItems() {
    setExtracting(true)
    const res = await apiFetch(`/meetings/${meeting.id}/action-items`, { method: 'POST' })
    const updated = await res.json()
    setCurrentMeeting(updated)
    onUpdate(updated)
    setExtracting(false)
    showToast('Action items extracted')
  }

  function parseActionItems(raw) {
    try {
      return JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      return []
    }
  }

  async function saveTitle() {
    if (!titleDraft.trim()) { setEditingTitle(false); return }
    if (titleDraft === currentMeeting.title) { setEditingTitle(false); return }
    const res = await apiFetch(`/meetings/${meeting.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleDraft }),
    })
    const updated = await res.json()
    setCurrentMeeting(updated)
    onUpdate(updated)
    setEditingTitle(false)
    showToast('Meeting renamed')
  }

  async function copyTranscript() {
    const text = transcripts
      .map(t => `${t.speaker_label || t.speaker} [${formatTime(t.start_time)}]: ${t.edited_text || t.text}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    showToast('Transcript copied to clipboard')
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
    showToast(`${format.toUpperCase()} downloaded`)
  }

  async function saveNotes() {
    const updated = await apiFetch(`/meetings/${meeting.id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).then(r => r.json())
    setCurrentMeeting(updated)
    onUpdate(updated)
    showToast('Notes saved')
  }

  const hasTranscript = transcripts.length > 0

  return (
    <div className="detail-view">
      <button className="back-btn" onClick={onBack}>
        ← Back <span className="esc-hint">esc</span>
      </button>

      {/* Header */}
      <div className="detail-header">
        {editingTitle ? (
          <input
            className="title-edit-input"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
            autoFocus
          />
        ) : (
          <h2 className="detail-title" onClick={() => setEditingTitle(true)} title="Click to rename">
            {currentMeeting.title}
            <span className="edit-icon">✎</span>
          </h2>
        )}
        {currentMeeting.description && <p className="detail-desc">{currentMeeting.description}</p>}
        <div className="detail-meta">
          {currentMeeting.meeting_date && (
            <span className="meta-date">
              {new Date(currentMeeting.meeting_date + 'T00:00:00').toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </span>
          )}
          <span className={`status-badge status-${currentMeeting.status}`}>
            {currentMeeting.status}
          </span>
        </div>
      </div>

      {/* Audio — always visible until uploaded */}
      {!uploaded && (
        <div className="detail-section">
          <SectionHeader title="Audio" isOpen onToggle={() => {}} />
          <div className="section-body">
            <div className="audio-options">
              <RecordButton onRecordingComplete={uploadAudio} disabled={uploading} />
              <div className="or-divider">or</div>
              <label className="upload-label">
                Upload Audio File (.mp3, .wav, .m4a, .mp4)
                <input type="file" accept=".mp3,.wav,.m4a,.webm,.mp4" onChange={handleFileUpload} hidden />
              </label>
              {uploading && <p className="uploading-text">Uploading audio...</p>}
            </div>
          </div>
        </div>
      )}

      {/* Transcribe — shown after upload, before transcript exists */}
      {uploaded && !hasTranscript && (
        <div className="detail-section">
          <SectionHeader title="Transcript" isOpen onToggle={() => {}} />
          <div className="section-body">
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
        </div>
      )}

      {/* Collapsible sections — only when transcript exists */}
      {hasTranscript && (
        <>
          {/* Transcript */}
          <div className="detail-section">
            <SectionHeader
              title="Transcript"
              isOpen={openSections.transcript}
              onToggle={() => toggleSection('transcript')}
              right={<button className="copy-btn" onClick={e => { e.stopPropagation(); copyTranscript() }}>Copy all</button>}
            />
            {openSections.transcript && (
              <div className="section-body">
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
          </div>

          {/* AI Summary */}
          <div className="detail-section">
            <SectionHeader
              title="AI Summary"
              isOpen={openSections.summary}
              onToggle={() => toggleSection('summary')}
            />
            {openSections.summary && (
              <div className="section-body">
                {summarizing ? (
                  <div className="transcribing-status"><span className="spinner" />Generating summary…</div>
                ) : currentMeeting.summary ? (
                  <div className="summary-text">
                    <ReactMarkdown>{currentMeeting.summary}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="section-empty">No summary yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Action Items */}
          <div className="detail-section">
            <SectionHeader
              title="Action Items"
              isOpen={openSections.actions}
              onToggle={() => toggleSection('actions')}
            />
            {openSections.actions && (
              <div className="section-body">
                {extracting ? (
                  <div className="transcribing-status"><span className="spinner" />Extracting action items…</div>
                ) : currentMeeting.action_items ? (
                  parseActionItems(currentMeeting.action_items).length === 0 ? (
                    <p className="action-items-empty">No action items found in this meeting.</p>
                  ) : (
                    <ul className="action-items-list">
                      {parseActionItems(currentMeeting.action_items).map((item, i) => (
                        <li key={i} className="action-item">
                          <div className="action-item-task">{item.task}</div>
                          <div className="action-item-meta">
                            <span className="action-item-person">{item.person}</span>
                            {item.deadline && (
                              <span className="action-item-deadline">due {item.deadline}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <p className="section-empty">No action items yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="detail-section">
            <SectionHeader
              title="Ask Echo AI"
              isOpen={openSections.chat}
              onToggle={() => toggleSection('chat')}
            />
            {openSections.chat && (
              <div className="section-body">
                <ChatPanel meetingId={meeting.id} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="detail-section">
            <SectionHeader
              title="Meeting Notes"
              isOpen={openSections.notes}
              onToggle={() => toggleSection('notes')}
            />
            {openSections.notes && (
              <div className="section-body">
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
          </div>

          {/* Export */}
          <div className="detail-section">
            <SectionHeader
              title="Export"
              isOpen={openSections.export}
              onToggle={() => toggleSection('export')}
            />
            {openSections.export && (
              <div className="section-body">
                <div className="export-buttons">
                  <button className="export-btn" onClick={() => downloadExport('pdf')}>Download PDF</button>
                  <button className="export-btn export-btn-excel" onClick={() => downloadExport('excel')}>Download Excel</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
