import { useState } from 'react'

function nameFromEmail(email) {
  if (!email) return ''
  const local = email.split('@')[0]
  const name = local.split(/[\d._-]/)[0]
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : ''
}

export default function SettingsPage({ onBack, onLogout, onDeleteAccount, stats, userEmail, userName }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const name = userName || nameFromEmail(userEmail)

  return (
    <div className="settings-page">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="settings-greeting">
        <h1 className="settings-title">Settings</h1>
        {name && <p className="settings-hello">Hello, {name}</p>}
      </div>

      <div className="settings-card">
        <h2 className="settings-card-title">Account</h2>
        {userName && (
          <div className="settings-row">
            <span className="settings-label">Name</span>
            <span className="settings-value">{userName}</span>
          </div>
        )}
        <div className="settings-row">
          <span className="settings-label">Email</span>
          <span className="settings-value">{userEmail}</span>
        </div>
      </div>

      {stats && (
        <div className="settings-card">
          <h2 className="settings-card-title">Usage</h2>
          <div className="settings-row">
            <span className="settings-label">Meetings</span>
            <span className="settings-value">{stats.total_meetings}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Audio processed</span>
            <span className="settings-value">{stats.total_hours}h</span>
          </div>
        </div>
      )}

      <div className="settings-card">
        <h2 className="settings-card-title">Session</h2>
        <div className="settings-row settings-row-action">
          <div>
            <span className="settings-label">Sign out of Echo</span>
            <p className="settings-hint">You'll need to sign back in to access your meetings.</p>
          </div>
          <button className="settings-signout-btn" onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      <div className="settings-card settings-card-danger">
        <h2 className="settings-card-title">Danger Zone</h2>
        {confirmDelete ? (
          <>
            <p className="danger-warning">This permanently deletes your account, all meetings, transcripts, and data. This cannot be undone.</p>
            <div className="danger-confirm-actions">
              <button className="danger-confirm-btn" onClick={onDeleteAccount}>Yes, delete my account</button>
              <button className="danger-cancel-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="settings-row settings-row-action">
            <div>
              <span className="settings-label">Delete account</span>
              <p className="settings-hint">Permanently remove your account and all associated data.</p>
            </div>
            <button className="danger-btn" onClick={() => setConfirmDelete(true)}>Delete Account</button>
          </div>
        )}
      </div>
    </div>
  )
}
