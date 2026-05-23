import { useState } from 'react'
import { API, setToken } from '../api'
import GoogleLoginButton from './GoogleLoginButton'

const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID
const hasGithub = !!import.meta.env.VITE_GITHUB_CLIENT_ID
const hasMicrosoft = !!import.meta.env.VITE_MICROSOFT_CLIENT_ID

export default function LoginPage({ onLogin, onBack, onLegal }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleGithubLogin() {
    const redirectUri = window.location.origin
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=github`
  }

  function handleMicrosoftLogin() {
    const redirectUri = window.location.origin
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${import.meta.env.VITE_MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=User.Read+openid+email+profile&state=microsoft`
  }


  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
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

        <>
            {(mode === 'login' || mode === 'register') && (
              <div className="auth-tabs">
                <button
                  className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => { setMode('login'); setError('') }}
                >Sign In</button>
                <button
                  className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                  onClick={() => { setMode('register'); setError('') }}
                >Create Account</button>
              </div>
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
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}
              {error && <p className="auth-error">{error}</p>}

              <button type="submit" disabled={loading}>
                {loading ? 'Please wait…' : titles[mode]}
              </button>
            </form>

            {(mode === 'login' || mode === 'register') && (hasGoogle || hasGithub || hasMicrosoft) && (
              <>
                <div className="auth-divider"><span>or</span></div>
                {hasGoogle && (
                  <GoogleLoginButton
                    loading={loading}
                    setLoading={setLoading}
                    setError={setError}
                    onLogin={onLogin}
                  />
                )}
                {hasGithub && (
                  <button
                    type="button"
                    className="google-btn"
                    onClick={handleGithubLogin}
                    disabled={loading}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    Continue with GitHub
                  </button>
                )}
                {hasMicrosoft && (
                  <button
                    type="button"
                    className="google-btn"
                    onClick={handleMicrosoftLogin}
                    disabled={loading}
                  >
                    <svg width="18" height="18" viewBox="0 0 23 23">
                      <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                      <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                      <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                      <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                    </svg>
                    Continue with Microsoft
                  </button>
                )}
              </>
            )}


          </>


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
