import { useState, useEffect } from 'react'
import { hexToNpub, shortenNpub } from '../lib/nip19'

declare const __GIT_SHA__: string
declare const __GIT_MESSAGE__: string
declare const __GIT_TIMESTAMP__: string

import { type ThemeMode } from '../hooks/useTheme'

const REPO = 'xdamman/quickchat'
const BRANCH = 'main'

interface UpdateInfo {
  sha: string
  message: string
  date: string
}

function useUpdateCheck() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = async () => {
    setChecking(true)
    setError(null)
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      })
      if (!res.ok) throw new Error('Failed to check for updates')
      const data = await res.json()
      const remoteSha = data.sha.slice(0, 7)
      if (remoteSha !== __GIT_SHA__) {
        setUpdate({
          sha: remoteSha,
          message: data.commit.message.split('\n')[0],
          date: new Date(data.commit.committer.date).toLocaleString()
        })
      } else {
        setUpdate(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  const applyUpdate = async () => {
    setUpdating(true)
    try {
      // Unregister service workers and clear caches to force fresh load
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(r => r.unregister()))
      }
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(n => caches.delete(n)))
      }
      window.location.reload()
    } catch {
      window.location.reload()
    }
  }

  useEffect(() => { check() }, [])

  return { update, checking, updating, error, check, applyUpdate }
}

interface Props {
  publicKeyHex: string
  displayName: string
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  onLogout: () => void
  onBack: () => void
}

export function Settings({ publicKeyHex, displayName, theme, onThemeChange, onLogout, onBack }: Props) {
  const npub = hexToNpub(publicKeyHex)
  const [copied, setCopied] = useState(false)
  const updateInfo = useUpdateCheck()

  const copyNpub = () => {
    navigator.clipboard.writeText(npub).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="settings">
      <div className="header">
        <button className="btn-back" onClick={onBack}>←</button>
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
      <div className="settings-section">
        <h2>Identity</h2>
        <div className="settings-card">
          <div className="settings-row">
            <span className="settings-label">Name</span>
            <span>{displayName}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">npub</span>
            <button className="npub-copy-btn" onClick={copyNpub}>
              <span className="mono">{shortenNpub(npub)}</span>
              <span className="npub-copy-icon">{copied ? '✓' : '📋'}</span>
              {copied && <span className="npub-copied-text">Copied!</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-card">
          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <select 
              value={theme} 
              onChange={(e) => onThemeChange(e.target.value as ThemeMode)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--gray-300)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '14px'
              }}
            >
              <option value="system">System Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>About</h2>
        <div className="settings-card">
          <p className="settings-about">
            Powered by Nostr. Messages are end-to-end encrypted.
            Your key never leaves this device.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Version</h2>
        <div className="settings-card">
          <div className="settings-row">
            <span className="settings-label">Build</span>
            <span className="mono">{__GIT_SHA__}</span>
          </div>
          <div className="settings-row version-message">
            <span>{__GIT_MESSAGE__}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Date</span>
            <span className="mono" style={{fontSize: '12px'}}>{__GIT_TIMESTAMP__}</span>
          </div>
        </div>

        {updateInfo.update ? (
          <div className="settings-card" style={{marginTop: 8, border: '1px solid var(--accent)', background: 'var(--bg-hover)'}}>
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start', gap: 4}}>
              <span style={{fontWeight: 600}}>🆕 Update available</span>
              <span className="mono" style={{fontSize: 12}}>{updateInfo.update.sha} — {updateInfo.update.message}</span>
              <span style={{fontSize: 12, color: 'var(--text-secondary)'}}>{updateInfo.update.date}</span>
            </div>
            <button
              className="btn-primary"
              style={{marginTop: 8, width: '100%'}}
              onClick={updateInfo.applyUpdate}
              disabled={updateInfo.updating}
            >
              {updateInfo.updating ? 'Updating…' : 'Update now'}
            </button>
          </div>
        ) : (
          <div style={{marginTop: 8, display: 'flex', alignItems: 'center', gap: 8}}>
            <button
              className="btn-secondary"
              style={{fontSize: 13, padding: '4px 12px'}}
              onClick={updateInfo.check}
              disabled={updateInfo.checking}
            >
              {updateInfo.checking ? 'Checking…' : 'Check for updates'}
            </button>
            {!updateInfo.checking && !updateInfo.error && (
              <span style={{fontSize: 12, color: 'var(--text-secondary)'}}>✓ Up to date</span>
            )}
            {updateInfo.error && (
              <span style={{fontSize: 12, color: 'var(--error)'}}>⚠ {updateInfo.error}</span>
            )}
          </div>
        )}
      </div>

      <button className="btn-logout" onClick={onLogout}>
        Logout
      </button>
      </div>
    </div>
  )
}
