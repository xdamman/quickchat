import { useState } from 'react'
import { type AppConfig } from '../config'

interface Props {
  config: AppConfig
  hasStoredCredential: boolean
  onRegister: (name: string) => Promise<void>
  onLogin: () => Promise<void>
  error: string | null
  loading: boolean
}

export function Onboarding({ config, hasStoredCredential, onRegister, onLogin, error, loading }: Props) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasStoredCredential) {
      onLogin()
    } else if (name.trim()) {
      onRegister(name.trim())
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-content">
        <div className="onboarding-icon">💬</div>
        <h1>{config.title}</h1>
        <p className="onboarding-desc">{config.description}</p>

        <form onSubmit={handleSubmit}>
          {hasStoredCredential ? (
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Authenticating…' : 'Unlock with passkey →'}
            </button>
          ) : (
            <>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-name"
                autoFocus
                maxLength={30}
              />
              <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
                {loading ? 'Creating passkey…' : 'Start chatting →'}
              </button>
            </>
          )}
        </form>

        {error && <p className="error-msg">{error}</p>}

        <div className="onboarding-footer">
          <p>🔒 Your messages are end-to-end encrypted.<br />No account needed. Powered by Nostr.</p>
        </div>
      </div>
    </div>
  )
}
