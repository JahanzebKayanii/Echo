import { useState } from 'react'

export default function SettingsPage({ onBack, onLogout, onDeleteAccount, stats, userEmail }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="settings-page">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="settings-title">Settings</h1>

      <div className="settings-card">
        <h2 className="settings-card-title">Account</h2>
        <div className="settings-row">
          <span className="settings-label">Email</span>
          <span className="settings-value">{userEmail}</span>
        </div>
      </div>

      {stats && (
        <div className="settings-card">
          <div className="settings-card-title-row">
            <h2 className="settings-card-title">Plan & Usage</h2>
            {stats.is_pro && <span className="pro-badge">Pro</span>}
          </div>
          {stats.is_pro ? (
            <div className="settings-row">
              <span className="settings-label">Plan</span>
              <span className="settings-value">Pro — unlimited meetings, files &amp; duration</span>
            </div>
          ) : (
            <>
              <div className="settings-row">
                <span className="settings-label">Plan</span>
                <span className="settings-value">Free</span>
              </div>
              <div className="settings-row">
                <span className="settings-label">Meetings used</span>
                <div className="settings-usage-wrap">
                  <div className="usage-bar-track">
                    <div
                      className={`usage-bar-fill ${stats.total_meetings >= stats.meeting_limit ? 'usage-bar-full' : ''}`}
                      style={{ width: `${Math.min((stats.total_meetings / stats.meeting_limit) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="usage-fraction">{stats.total_meetings} / {stats.meeting_limit}</span>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">Audio processed</span>
                <span className="settings-value">{stats.total_hours}h</span>
              </div>
            </>
          )}
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
