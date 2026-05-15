export const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export const getToken = () => localStorage.getItem('echo_token')
export const setToken = (t) => localStorage.setItem('echo_token', t)
export const clearToken = () => localStorage.removeItem('echo_token')

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    window.location.reload()
  }
  return res
}
