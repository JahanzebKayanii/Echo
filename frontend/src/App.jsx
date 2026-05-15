import { useState, useEffect } from 'react'
import MeetingDetail from './components/MeetingDetail'
import LoginPage from './components/LoginPage'
import { apiFetch, getToken, clearToken } from './api'
import './App.css'

function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken())
  const [meetings, setMeetings] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (loggedIn) {
      fetchMeetings()
      fetchStats()
    }
  }, [loggedIn])

  async function fetchMeetings() {
    const res = await apiFetch('/meetings')
    const data = await res.json()
    setMeetings(data)
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
    await apiFetch('/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    })
    setTitle('')
    setDescription('')
    setLoading(false)
    fetchMeetings()
    fetchStats()
  }

  async function deleteMeeting(e, id) {
    e.stopPropagation()
    await apiFetch(`/meetings/${id}`, { method: 'DELETE' })
    fetchMeetings()
    fetchStats()
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
  }

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />
  }

  const displayedMeetings = searchQuery.trim()
    ? meetings.filter(m =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : meetings

  if (selectedMeeting) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Echo</h1>
          <p>AI Conversation Intelligence</p>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </header>
        <main className="app-main">
          <MeetingDetail
            meeting={selectedMeeting}
            onBack={() => { setSelectedMeeting(null); fetchStats() }}
            onUpdate={handleMeetingUpdate}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Echo</h1>
        <p>AI Conversation Intelligence</p>
        <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
      </header>

      <main className="app-main">
        {stats && (
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-value">{stats.total_meetings}</span>
              <span className="stat-label">Meetings</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.total_hours}h</span>
              <span className="stat-label">Audio Processed</span>
            </div>
          </div>
        )}

        <section className="create-section">
          <h2>New Meeting</h2>
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
              rows={3}
            />
            <button type="submit" disabled={loading}>
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
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {displayedMeetings.length === 0 ? (
            <p className="empty">
              {searchQuery ? 'No meetings match your search.' : 'No meetings yet. Create one above.'}
            </p>
          ) : (
            <ul>
              {displayedMeetings.map(m => (
                <li key={m.id} className="meeting-card" onClick={() => setSelectedMeeting(m)}>
                  <div className="meeting-info">
                    <h3>{m.title}</h3>
                    {m.description && <p>{m.description}</p>}
                    <span className="meta">
                      {new Date(m.created_at).toLocaleString()} · <span className={`status-badge status-${m.status}`}>{m.status}</span>
                    </span>
                  </div>
                  <button className="delete-btn" onClick={(e) => deleteMeeting(e, m.id)}>
                    Delete
                  </button>
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
