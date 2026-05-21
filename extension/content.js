function syncToken() {
  try {
    const token = localStorage.getItem('echo_token')
    if (token) {
      chrome.storage.local.set({ echo_token: token })
    } else {
      chrome.storage.local.remove('echo_token')
    }
  } catch {
    clearInterval(interval)
  }
}

syncToken()
const interval = setInterval(syncToken, 2000)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN') {
    sendResponse({ token: localStorage.getItem('echo_token') || null })
  }
  return true
})
