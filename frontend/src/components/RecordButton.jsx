import { useState, useRef } from 'react'

export default function RecordButton({ onRecordingComplete, disabled }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const mediaRecorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunks.current = []

    recorder.ondataavailable = e => chunks.current.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' })
      onRecordingComplete(blob, 'recording.webm')
      stream.getTracks().forEach(t => t.stop())
    }

    recorder.start()
    mediaRecorder.current = recorder
    setRecording(true)
    setSeconds(0)
    timer.current = setInterval(() => setSeconds(s => s + 1), 1000)
  }

  function stopRecording() {
    mediaRecorder.current.stop()
    clearInterval(timer.current)
    setRecording(false)
  }

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="record-section">
      {recording ? (
        <div className="recording-active">
          <span className="record-dot" />
          <span className="record-time">{formatTime(seconds)}</span>
          <button className="stop-btn" onClick={stopRecording} disabled={disabled}>
            Stop Recording
          </button>
        </div>
      ) : (
        <button className="record-btn" onClick={startRecording} disabled={disabled}>
          🎙 Start Recording
        </button>
      )}
    </div>
  )
}
