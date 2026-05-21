const API_URL = 'https://echo-backend-wom7.onrender.com'

let mediaRecorder = null
let audioChunks = []
let currentMeetingId = null

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'START_RECORDING_OFFSCREEN') {
    currentMeetingId = msg.meetingId
    startRecording()
  } else if (msg.type === 'STOP_RECORDING_OFFSCREEN') {
    stopRecording()
  }
})

async function startRecording() {
  audioChunks = []
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.onstop = uploadRecording
    mediaRecorder.start(1000)
  } catch {
    chrome.runtime.sendMessage({ type: 'UPLOAD_ERROR', error: 'Microphone access denied. Click the camera icon in Chrome\'s address bar to allow it.' })
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach(t => t.stop())
  }
}

async function uploadRecording() {
  const token = await new Promise(resolve =>
    chrome.storage.local.get('echo_token', d => resolve(d.echo_token || null))
  )
  if (!token || !currentMeetingId) {
    chrome.runtime.sendMessage({ type: 'UPLOAD_ERROR', error: 'Not signed in.' })
    return
  }

  const blob = new Blob(audioChunks, { type: 'audio/webm' })
  const formData = new FormData()
  formData.append('file', blob, 'recording.webm')

  try {
    const res = await fetch(`${API_URL}/meetings/${currentMeetingId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) {
      chrome.runtime.sendMessage({ type: 'UPLOAD_ERROR', error: 'Upload failed. Try again.' })
      return
    }
    chrome.runtime.sendMessage({ type: 'UPLOAD_DONE' })
  } catch {
    chrome.runtime.sendMessage({ type: 'UPLOAD_ERROR', error: 'Network error. Check your connection.' })
  }
}
