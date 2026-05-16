import { useState, useEffect } from 'react'
import { API, setToken } from '../api'

export default function LoginPage({ onLogin, onBack, onLegal }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifyToken = params.get('verify')
    const resetTok = params.get('reset')

    if (verifyToken) {
      setMode('verifying')
      fetch(`${API}/auth/verify?token=${verifyToken}`)
        .then(r => r.json())
        .then(data => {
          if (data.message) {
            setMode('verified')
            setInfo(data.message)
          } else {
            setMode('verify-error')
            setError(data.detail || 'Verification failed.')
          }
        })
        .catch(() => { setMode('verify-error'); setError('Could not connect to server.') })
      window.history.replaceState({}, '', '/')
    } else if (resetTok) {
      setResetToken(resetTok)
      setMode('reset')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const res = await fetch(`${API}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json()
        setInfo(data.message)
        setEmail('')
        return
      }

      if (mode === 'reset') {
        const res = await fetch(`${API}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, new_password: newPassword }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.detail || 'Reset failed.'); return }
        setInfo(data.message)
        setMode('login')
        setNewPassword('')
        return
      }

      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { email, password, name: name.trim() || null } : { email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Something went wrong.')
        return
      }

      if (mode === 'register') {
        setInfo('Account created! Check your email to verify before signing in.')
        setMode('login')
        setEmail('')
        setName('')
        setPassword('')
        return
      }

      setToken(data.access_token)
      onLogin()
    } catch {
      setError('Could not connect to server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    login: 'Sign In', register: 'Create Account',
    forgot: 'Reset Password', reset: 'New Password',
    verifying: 'Verifying…', verified: 'Email Verified',
    'verify-error': 'Verification Failed',
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-card">
        {onBack && (
          <button className="auth-back-btn" onClick={onBack}>← Back to home</button>
        )}
        <h1 className="auth-logo">Echo</h1>
        <p className="auth-tagline">AI Conversation Intelligence</p>

        {(mode === 'verifying' || mode === 'verified' || mode === 'verify-error') ? (
          <div className="auth-status">
            {mode === 'verifying' && <p className="auth-info">Verifying your email…</p>}
            {mode === 'verified' && (
              <>
                <p className="auth-info">{info}</p>
                <button className="auth-link-btn" onClick={() => { setMode('login'); setInfo('') }}>
                  Go to Sign In
                </button>
              </>
            )}
            {mode === 'verify-error' && (
              <>
                <p className="auth-error">{error}</p>
                <button className="auth-link-btn" onClick={() => { setMode('login'); setError('') }}>
                  Back to Sign In
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {(mode === 'login' || mode === 'register') && (
              <div className="auth-tabs">
                <button
                  className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => { setMode('login'); setError(''); setInfo('') }}
                >Sign In</button>
                <button
                  className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                  onClick={() => { setMode('register'); setError(''); setInfo('') }}
                >Create Account</button>
              </div>
            )}

            {(mode === 'forgot' || mode === 'reset') && (
              <p className="auth-mode-title">{titles[mode]}</p>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              )}
              {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              )}
              {(mode === 'login' || mode === 'register') && (
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}
              {mode === 'reset' && (
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}

              {error && <p className="auth-error">{error}</p>}
              {info && <p className="auth-info">{info}</p>}

              <button type="submit" disabled={loading}>
                {loading ? 'Please wait…' : titles[mode]}
              </button>
            </form>

            {mode === 'login' && (
              <button
                className="auth-link-btn"
                onClick={() => { setMode('forgot'); setError(''); setInfo('') }}
              >
                Forgot your password?
              </button>
            )}

            {(mode === 'forgot' || mode === 'reset') && (
              <button
                className="auth-link-btn"
                onClick={() => { setMode('login'); setError(''); setInfo('') }}
              >
                Back to Sign In
              </button>
            )}

            {mode === 'register' && (
              <p className="auth-hint">You'll receive a verification email after registering.</p>
            )}
          </>
        )}

        {onLegal && (
          <div className="auth-legal-links">
            <button className="footer-link" onClick={() => onLegal('tos')}>Terms of Service</button>
            <span className="auth-legal-sep">·</span>
            <button className="footer-link" onClick={() => onLegal('privacy')}>Privacy Policy</button>
          </div>
        )}
      </div>
    </div>
  )
}
