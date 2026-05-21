const ECHO_URL = 'https://echo-silk-one.vercel.app'
const API_URL = 'https://echo-backend-wom7.onrender.com'

let timerInterval = null
let startTime = null
let meetingId = null

function show(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'))
  document.getElementById(viewId).classList.remove('hidden')
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Try storage first, then ask content script on Echo tab directly
async function getToken() {
  const stored = await new Promise(resolve =>
    chrome.storage.local.get('echo_token', d => resolve(d.echo_token || null))
  )
  if (stored) return stored

  // Ask content script running on Echo tab
  const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve))
  const echoTab = tabs.find(t => t.url && t.url.includes('echo-silk-one.vercel.app'))
  if (!echoTab) return null

  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(null), 2000)
    chrome.tabs.sendMessage(echoTab.id, { type: 'GET_TOKEN' }, response => {
      clearTimeout(timeout)
      if (chrome.runtime.lastError) { resolve(null); return }
      const token = response?.token
      if (token) chrome.storage.local.set({ echo_token: token })
      resolve(token || null)
    })
  })
}

async function init() {
  let token
  try { token = await getToken() } catch { token = null }
  if (!token) { show('view-notloggedin'); return }

  // Verify token with backend
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      chrome.storage.local.remove('echo_token')
      show('view-notloggedin')
      return
    }
    const data = await res.json()
    document.getElementById('user-email').textContent = data.email
  } catch {
    show('view-notloggedin')
    return
  }

  // Check current state from storage
  chrome.storage.local.get(['echo_recording', 'echo_start_time', 'echo_meeting_id', 'echo_uploading', 'echo_upload_done', 'echo_upload_error'], d => {
    if (d.echo_upload_done) {
      chrome.storage.local.remove('echo_upload_done')
      show('view-done')
    } else if (d.echo_upload_error) {
      const err = d.echo_upload_error
      chrome.storage.local.remove('echo_upload_error')
      showError(err)
    } else if (d.echo_uploading) {
      show('view-uploading')
    } else if (d.echo_recording) {
      startTime = d.echo_start_time
      meetingId = d.echo_meeting_id
      show('view-recording')
      startTimer()
    } else {
      const now = new Date()
      const defaultTitle = 'Meeting — ' + now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      document.getElementById('meeting-title').placeholder = defaultTitle
      show('view-idle')
    }
  })

  // Auto-update popup when upload finishes in the background
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.echo_upload_done?.newValue) {
      chrome.storage.local.remove('echo_upload_done')
      show('view-done')
    } else if (changes.echo_upload_error?.newValue) {
      const err = changes.echo_upload_error.newValue
      chrome.storage.local.remove('echo_upload_error')
      showError(err)
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
  const now = new Date()
  const defaultTitle = 'Meeting — ' + now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const title = document.getElementById('meeting-title').value.trim() || defaultTitle

  try {
    const res = await fetch(`${API_URL}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showError(err.detail || `Error ${res.status}: Could not create meeting.`)
      return
    }
    const meeting = await res.json()
    meetingId = meeting.id
  } catch {
    showError('Could not connect to Echo.')
    return
  }

  startTime = Date.now()
  // Wait for storage to be written before opening recorder tab
  await new Promise(resolve =>
    chrome.storage.local.set({ echo_recording: true, echo_start_time: startTime, echo_meeting_id: meetingId }, resolve)
  )
  chrome.tabs.create({ url: chrome.runtime.getURL('recorder.html') })
  show('view-recording')
  startTimer()
})

// Stop recording
document.getElementById('btn-stop').addEventListener('click', () => {
  clearInterval(timerInterval)
  show('view-uploading')
  chrome.storage.local.set({ echo_stop_recording: true })
})

// Listen for upload result
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
  // Poll every second — once signed in, auto-advance to recording view
  const poll = setInterval(async () => {
    const token = await getToken()
    if (token) { clearInterval(poll); init() }
  }, 1000)
  setTimeout(() => clearInterval(poll), 120000)
})

document.getElementById('btn-already-signedin').addEventListener('click', init)

document.getElementById('btn-retry').addEventListener('click', () => show('view-idle'))

document.getElementById('btn-cancel-recording').addEventListener('click', () => {
  clearInterval(timerInterval)
  chrome.storage.local.remove(['echo_recording', 'echo_start_time', 'echo_meeting_id', 'echo_stop_recording', 'echo_uploading', 'echo_upload_done', 'echo_upload_error'])
  show('view-idle')
})

function showError(msg) {
  document.getElementById('error-msg').textContent = msg
  show('view-error')
}

init()
