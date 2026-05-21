async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
  if (existing.length > 0) return
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording microphone audio for Echo meeting transcription',
  })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SYNC_TOKEN') {
    if (msg.token) {
      chrome.storage.local.set({ echo_token: msg.token })
    } else {
      chrome.storage.local.remove('echo_token')
    }
  } else if (msg.type === 'START_RECORDING') {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: 'START_RECORDING_OFFSCREEN', meetingId: msg.meetingId })
    })
  } else if (msg.type === 'STOP_RECORDING') {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING_OFFSCREEN' })
  }
})
