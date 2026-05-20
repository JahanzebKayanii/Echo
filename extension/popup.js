const ECHO_URL = 'https://echo-silk-one.vercel.app'
const API_URL = 'https://echo-api-hfq5.onrender.com'

let timerInterval = null
let startTime = null
let meetingId = null

function show(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'))
  document.getElementById(viewId).classList.remove('hidden')
}

function getToken() {
  return new Promise(resolve => {
    chrome.storage.local.get('echo_token', d => resolve(d.echo_token || null))
  })
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function init() {
  const token = await getToken()
  if (!token) {
    show('view-notloggedin')
    return
  }

  // Verify token and get email
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) { show('view-notloggedin'); return }
    const data = await res.json()
    document.getElementById('user-email').textContent = data.email
  } catch {
    show('view-notloggedin')
    return
  }

  // Check if already recording
  chrome.storage.local.get(['echo_recording', 'echo_start_time', 'echo_meeting_id'], d => {
    if (d.echo_recording) {
      startTime = d.echo_start_time
      meetingId = d.echo_meeting_id
      show('view-recording')
      startTimer()
    } else {
      show('view-idle')
    }
  })
}

function startTimer() {
  const el = document.getElementById('timer')
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    el.textContent = formatTime(elapsed)
  }, 1000)
}

// Start recording
document.getElementById('btn-record').addEventListener('click', async () => {
  const token = await getToken()
  const title = document.getElementById('meeting-title').value.trim() || 'Meeting Recording'

  // Create meeting in Echo first
  try {
    const res = await fetch(`${API_URL}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) {
      showError('Could not create meeting. Check your Echo account.')
      return
    }
    const meeting = await res.json()
    meetingId = meeting.id
  } catch {
    showError('Could not connect to Echo.')
    return
  }

  // Tell background to start recording
  startTime = Date.now()
  chrome.storage.local.set({ echo_recording: true, echo_start_time: startTime, echo_meeting_id: meetingId })
  chrome.runtime.sendMessage({ type: 'START_RECORDING', meetingId })

  show('view-recording')
  startTimer()
})

// Stop recording
document.getElementById('btn-stop').addEventListener('click', () => {
  clearInterval(timerInterval)
  show('view-uploading')
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING' })
})

// Listen for upload result from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPLOAD_DONE') {
    chrome.storage.local.remove(['echo_recording', 'echo_start_time', 'echo_meeting_id'])
    show('view-done')
  } else if (msg.type === 'UPLOAD_ERROR') {
    chrome.storage.local.remove(['echo_recording', 'echo_start_time', 'echo_meeting_id'])
    showError(msg.error || 'Upload failed. Try again.')
  }
})

document.getElementById('btn-view-meeting').addEventListener('click', () => {
  chrome.tabs.create({ url: ECHO_URL })
})

document.getElementById('btn-record-another').addEventListener('click', () => {
  meetingId = null
  document.getElementById('meeting-title').value = ''
  show('view-idle')
})

document.getElementById('btn-open-echo').addEventListener('click', () => {
  chrome.tabs.create({ url: ECHO_URL })
})

document.getElementById('btn-retry').addEventListener('click', () => {
  show('view-idle')
})

function showError(msg) {
  document.getElementById('error-msg').textContent = msg
  show('view-error')
}

init()
