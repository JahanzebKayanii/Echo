const API_URL = 'https://echo-api-hfq5.onrender.com'

let mediaRecorder = null
let audioChunks = []
let currentMeetingId = null

function getToken() {
  return new Promise(resolve => {
    chrome.storage.local.get('echo_token', d => resolve(d.echo_token || null))
  })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SYNC_TOKEN') {
    if (msg.token) {
      chrome.storage.local.set({ echo_token: msg.token })
    } else {
      chrome.storage.local.remove('echo_token')
    }
  } else if (msg.type === 'START_RECORDING') {
    currentMeetingId = msg.meetingId
    startRecording()
  } else if (msg.type === 'STOP_RECORDING') {
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
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'UPLOAD_ERROR', error: 'Microphone access denied. Please allow microphone permission.' })
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach(t => t.stop())
  }
}

async function uploadRecording() {
  const token = await getToken()
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
