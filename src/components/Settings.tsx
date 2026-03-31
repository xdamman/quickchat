import { useState } from 'react'
import { hexToNpub, shortenNpub } from '../lib/nip19'

interface Props {
  publicKeyHex: string
  displayName: string
  onLogout: () => void
  onBack: () => void
}

export function Settings({ publicKeyHex, displayName, onLogout, onBack }: Props) {
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
        <h2>About</h2>
        <div className="settings-card">
          <p className="settings-about">
            Powered by Nostr. Messages are end-to-end encrypted (NIP-17).
            Your key never leaves this device.
          </p>
        </div>
      </div>

      <button className="btn-logout" onClick={onLogout}>
        Logout
      </button>
    </div>
  )
}
