import { useState } from 'react'
import { hexToNpub, shortenNpub } from '../lib/nip19'

declare const __GIT_SHA__: string
declare const __GIT_MESSAGE__: string
declare const __GIT_TIMESTAMP__: string

import { type ThemeMode } from '../hooks/useTheme'

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
      </div>

      <button className="btn-logout" onClick={onLogout}>
        Logout
      </button>
      </div>
    </div>
  )
}
