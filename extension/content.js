// Runs on echo-silk-one.vercel.app — syncs the auth token to extension storage
function syncToken() {
  const token = localStorage.getItem('echo_token')
  if (token) {
    chrome.runtime.sendMessage({ type: 'SYNC_TOKEN', token })
  }
}

syncToken()

// Watch for token changes (login/logout)
window.addEventListener('storage', e => {
  if (e.key === 'echo_token') {
    chrome.runtime.sendMessage({ type: 'SYNC_TOKEN', token: e.newValue || '' })
  }
})
