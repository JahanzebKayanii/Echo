import { useState } from 'react'
import { apiFetch } from '../api'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TranscriptLine({ transcript, color, onRenameSpeaker, onTextSaved }) {
  const displaySpeaker = transcript.speaker_label || transcript.speaker
  const displayText = transcript.edited_text || transcript.text

  const [editingText, setEditingText] = useState(false)
  const [text, setText] = useState(displayText)
  const [editingSpeaker, setEditingSpeaker] = useState(false)
  const [speaker, setSpeaker] = useState(displaySpeaker)

  async function saveText() {
    setEditingText(false)
    await apiFetch(`/transcripts/${transcript.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edited_text: text }),
    })
    onTextSaved()
  }

  async function saveSpeaker() {
    setEditingSpeaker(false)
    if (speaker.trim() && speaker !== displaySpeaker) {
      await onRenameSpeaker(displaySpeaker, speaker.trim())
    } else {
      setSpeaker(displaySpeaker)
    }
  }

  return (
    <li className="transcript-line">
      <div className="transcript-meta">
        {editingSpeaker ? (
          <input
            className="speaker-input"
            value={speaker}
            onChange={e => setSpeaker(e.target.value)}
            onBlur={saveSpeaker}
            onKeyDown={e => e.key === 'Enter' && saveSpeaker()}
            autoFocus
          />
        ) : (
          <span
            className="transcript-speaker"
            style={{ color }}
            onClick={() => setEditingSpeaker(true)}
            title="Click to rename speaker"
          >
            {speaker}
          </span>
        )}
        <span className="transcript-time">{formatTime(transcript.start_time)}</span>
        <span className="edit-hint">click text or name to edit</span>
      </div>

      {editingText ? (
        <textarea
          className="transcript-edit-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={saveText}
          autoFocus
          rows={2}
        />
      ) : (
        <p
          className="transcript-text"
          onClick={() => setEditingText(true)}
          title="Click to edit"
        >
          {text}
        </p>
      )}
    </li>
  )
}
