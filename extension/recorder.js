const API_URL = 'https://echo-backend-wom7.onrender.com'

let mediaRecorder = null
let audioChunks = []
let timerInterval = null
let activeStream = null

const statusEl = document.getElementById('status')
const timerEl = document.getElementById('timer')
const dotEl = document.getElementById('dot')

function formatTime(s) {
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
}

function showError(msg) {
  const btn = document.getElementById('btn-stop')
  if (btn) btn.disabled = true
  dotEl.style.background = '#f87171'
  dotEl.style.animation = 'none'
  statusEl.style.color = '#f87171'
  statusEl.textContent = msg
  timerEl.textContent = ''
  chrome.storage.local.set({ echo_upload_error: msg })
  chrome.storage.local.remove(['echo_uploading', 'echo_recording'])
}

// Called by the Stop & Upload button in the tab
function stopNow() {
  const btn = document.getElementById('btn-stop')
  if (btn) btn.disabled = true
  clearInterval(timerInterval)
  statusEl.textContent = 'Finishing recording…'
  dotEl.style.animation = 'none'
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop() // onstop fires → stops stream → uploads
  }
}

async function start() {
  await new Promise(r => setTimeout(r, 300))

  const { echo_meeting_id, echo_token } = await new Promise(resolve =>
    chrome.storage.local.get(['echo_meeting_id', 'echo_token'], resolve)
  )

  if (!echo_meeting_id || !echo_token) {
    showError('Missing meeting info. Please try again from the extension.')
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    activeStream = stream
    statusEl.textContent = 'Recording your meeting…'

    audioChunks = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 })
    mediaRecorder._meetingId = echo_meeting_id
    mediaRecorder._token = echo_token
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.onstop = () => {
      if (activeStream) activeStream.getTracks().forEach(t => t.stop())
      upload(echo_meeting_id, echo_token)
    }
    mediaRecorder.start(1000)

    const startTime = Date.now()
    timerInterval = setInterval(() => {
      timerEl.textContent = formatTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    // Listen for stop signal from popup
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.echo_stop_recording?.newValue === true) {
        chrome.storage.local.remove('echo_stop_recording')
        statusEl.textContent = 'Finishing recording…'
        stopNow()
      }
    })

  } catch {
    showError('Microphone access denied. Please allow microphone access and try again.')
  }
}

document.getElementById('btn-stop').addEventListener('click', stopNow)

async function upload(meetingId, token) {
  statusEl.textContent = 'Uploading… (may take a minute on first upload)'
  chrome.storage.local.set({ echo_uploading: true })

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
  const blob = new Blob(audioChunks, { type: mimeType })
  const formData = new FormData()
  formData.append('file', blob, 'recording.webm')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 min max

  try {
    const res = await fetch(`${API_URL}/meetings/${meetingId}/audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showError(err.detail || `Upload failed (${res.status}). Try again.`)
      return
    }
    chrome.storage.local.set({ echo_upload_done: true })
    chrome.storage.local.remove(['echo_uploading', 'echo_recording', 'echo_start_time', 'echo_meeting_id', 'echo_stop_recording'])
    statusEl.textContent = 'Done! Closing…'
    dotEl.style.background = '#4ade80'
    setTimeout(() => window.close(), 1500)
  } catch (e) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') {
      showError('Upload timed out. Check your connection and try again.')
    } else {
      showError('Upload failed: ' + e.message)
    }
  }
}

start()
