import { useState, useEffect } from 'react'
import MeetingDetail from './components/MeetingDetail'
import LoginPage from './components/LoginPage'
import LandingPage from './components/LandingPage'
import LegalPage from './components/LegalPage'
import SettingsPage from './components/SettingsPage'
import { useToast, ToastContainer } from './components/Toast'
import { apiFetch, getToken, clearToken } from './api'
import './App.css'

function formatDuration(seconds) {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken())
  const [showAuth, setShowAuth] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [legalPage, setLegalPage] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMeetings, setLoadingMeetings] = useState(true)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [activeTag, setActiveTag] = useState(null)
  const [stats, setStats] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const { toasts, showToast } = useToast()

  useEffect(() => {
    if (loggedIn) {
      fetchMeetings()
      fetchStats()
      apiFetch('/auth/me').then(r => r.json()).then(d => setUserEmail(d.email || ''))
    }
  }, [loggedIn])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const timer = setTimeout(async () => {
      const res = await apiFetch(`/meetings/search/query?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(Array.isArray(data) ? data : [])
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  async function fetchMeetings() {
    setLoadingMeetings(true)
    const res = await apiFetch('/meetings')
    const data = await res.json()
    setMeetings(data)
    setLoadingMeetings(false)
  }

  async function fetchStats() {
    const res = await apiFetch('/stats')
    const data = await res.json()
    setStats(data)
  }

  async function createMeeting(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const res = await apiFetch('/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, meeting_date: meetingDate || null }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast(err.detail || 'Could not create meeting.', 'error')
      setLoading(false)
      return
    }
    setTitle('')
    setDescription('')
    setMeetingDate('')
    setLoading(false)
    fetchMeetings()
    fetchStats()
    showToast('Meeting created')
  }

  async function deleteMeeting(e, id) {
    e.stopPropagation()
    try {
      const res = await apiFetch(`/meetings/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.detail || `Delete failed (${res.status})`, 'error')
        setConfirmDelete(null)
        return
      }
      setConfirmDelete(null)
      if (selectedMeeting?.id === id) setSelectedMeeting(null)
      await fetchMeetings()
      fetchStats()
      showToast('Meeting deleted', 'error')
    } catch (err) {
      showToast('Network error: ' + err.message, 'error')
      setConfirmDelete(null)
    }
  }

  function handleMeetingUpdate(updated) {
    setSelectedMeeting(updated)
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  function handleLogout() {
    clearToken()
    setLoggedIn(false)
    setMeetings([])
    setSelectedMeeting(null)
    setStats(null)
    setShowSettings(false)
    setUserEmail('')
  }

  async function handleDeleteAccount() {
    const res = await apiFetch('/auth/account', { method: 'DELETE' })
    if (res.ok) {
      clearToken()
      setLoggedIn(false)
      setShowAuth(false)
      setShowSettings(false)
    } else {
      showToast('Could not delete account. Try again.', 'error')
    }
  }

  if (legalPage) {
    return <LegalPage type={legalPage} onBack={() => setLegalPage(null)} />
  }

  if (!loggedIn) {
    if (!showAuth) {
      return (
        <LandingPage
          onGetStarted={() => setShowAuth(true)}
          onSignIn={() => setShowAuth(true)}
          onLegal={setLegalPage}
        />
      )
    }
    return (
      <LoginPage
        onLogin={() => setLoggedIn(true)}
        onBack={() => setShowAuth(false)}
        onLegal={setLegalPage}
      />
    )
  }

  const allTags = [...new Set(
    meetings.flatMap(m => (m.tags || '').split(',').map(t => t.trim()).filter(Boolean))
  )]

  const baseMeetings = searchResults !== null ? searchResults : meetings
  const displayedMeetings = activeTag
    ? baseMeetings.filter(m => (m.tags || '').split(',').map(t => t.trim()).includes(activeTag))
    : baseMeetings

  if (showSettings) {
    return (
      <div className="app">
        <ToastContainer toasts={toasts} />
        <header className="app-header">
          <h1>Echo</h1>
          <p>AI Conversation Intelligence</p>
          <button className="user-avatar-btn" onClick={() => setShowSettings(false)} title="Back">
            {userEmail ? userEmail[0].toUpperCase() : '?'}
          </button>
        </header>
        <main className="app-main">
          <SettingsPage
            onBack={() => setShowSettings(false)}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            stats={stats}
            userEmail={userEmail}
          />
        </main>
      </div>
    )
  }

  if (selectedMeeting) {
    return (
      <div className="app">
        <ToastContainer toasts={toasts} />
        <header className="app-header">
          <h1>Echo</h1>
          <p>AI Conversation Intelligence</p>
          <button className="user-avatar-btn" onClick={() => setShowSettings(true)} title="Settings">
            {userEmail ? userEmail[0].toUpperCase() : '?'}
          </button>
        </header>
        <main className="app-main">
          <MeetingDetail
            meeting={selectedMeeting}
            onBack={() => { setSelectedMeeting(null); fetchStats() }}
            onUpdate={handleMeetingUpdate}
            showToast={showToast}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <ToastContainer toasts={toasts} />
      <header className="app-header">
        <h1>Echo</h1>
        <p>AI Conversation Intelligence</p>
        <button className="user-avatar-btn" onClick={() => setShowSettings(true)} title="Settings">
          {userEmail ? userEmail[0].toUpperCase() : '?'}
        </button>
      </header>

      <main className="app-main">
        {stats && (
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-value">{stats.total_hours}h</span>
              <span className="stat-label">Audio Processed</span>
            </div>
            {stats.is_pro ? (
              <div className="stat-item usage-item">
                <div className="usage-header">
                  <span className="stat-label">Plan</span>
                  <span className="pro-badge">Pro</span>
                </div>
                <span className="pro-sub">No limits on meetings, file size, or duration</span>
              </div>
            ) : (
              <div className="stat-item usage-item">
                <div className="usage-header">
                  <span className="stat-label">Meetings Used</span>
                  <span className="usage-fraction">{stats.total_meetings} / {stats.meeting_limit}</span>
                </div>
                <div className="usage-bar-track">
                  <div
                    className={`usage-bar-fill ${stats.total_meetings >= stats.meeting_limit ? 'usage-bar-full' : ''}`}
                    style={{ width: `${Math.min((stats.total_meetings / stats.meeting_limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <section className="create-section">
          <h2>New Meeting</h2>
          {!stats?.is_pro && stats?.total_meetings >= stats?.meeting_limit && (
            <p className="limit-warning">You've reached the free plan limit of {stats.meeting_limit} meetings. Delete a meeting to create a new one.</p>
          )}
          <form onSubmit={createMeeting}>
            <input
              type="text"
              placeholder="Meeting title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
            <div className="date-row">
              <label className="date-label">Meeting date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="date-input"
              />
            </div>
            <button type="submit" disabled={loading || (!stats?.is_pro && stats?.total_meetings >= stats?.meeting_limit)}>
              {loading ? 'Creating...' : 'Create Meeting'}
            </button>
          </form>
        </section>

        <section className="meetings-section">
          <div className="meetings-header">
            <h2>Meetings ({displayedMeetings.length})</h2>
            <input
              className="search-input"
              type="text"
              placeholder="Search titles, descriptions, transcripts..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setActiveTag(null) }}
            />
          </div>
          {allTags.length > 0 && (
            <div className="tag-filter-row">
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tag-filter-chip ${activeTag === tag ? 'active' : ''}`}
                  onClick={() => { setActiveTag(activeTag === tag ? null : tag); setSearchQuery('') }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {loadingMeetings ? (
            <div className="skeleton-list">
              {[1, 2, 3].map(i => <div key={i} className="skeleton-card" />)}
            </div>
          ) : displayedMeetings.length === 0 ? (
            <p className="empty">
              {searchQuery ? 'No meetings match your search.' : 'No meetings yet. Create one above.'}
            </p>
          ) : (
            <ul>
              {displayedMeetings.map(m => (
                <li
                  key={m.id}
                  className="meeting-card"
                  onClick={() => { setConfirmDelete(null); setSelectedMeeting(m) }}
                >
                  <div className="meeting-info">
                    <h3>{m.title}</h3>
                    {m.description && <p>{m.description}</p>}
                    {m.tags && (
                      <div className="card-tags">
                        {m.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                          <span key={tag} className="tag-pill-small">{tag}</span>
                        ))}
                      </div>
                    )}
                    <span className="meta">
                      {m.meeting_date
                        ? new Date(m.meeting_date + 'T00:00:00').toLocaleDateString()
                        : new Date(m.created_at).toLocaleString()}
                      {formatDuration(m.duration_seconds) && (
                        <span className="duration-badge">{formatDuration(m.duration_seconds)}</span>
                      )}
                      {' · '}
                      <span className={`status-badge status-${m.status}`}>{m.status}</span>
                    </span>
                  </div>
                  <div className="card-actions">
                    {confirmDelete === m.id ? (
                      <>
                        <button
                          className="delete-confirm-btn"
                          onClick={(e) => { e.stopPropagation(); deleteMeeting(e, m.id) }}
                        >Yes, delete</button>
                        <button
                          className="delete-cancel-btn"
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(null) }}
                        >Cancel</button>
                      </>
                    ) : (
                      <button
                        className="delete-btn"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.id) }}
                      >Delete</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </main>
    </div>
  )
}

export default App
