import { useState, useEffect } from 'react'
import { type AppConfig } from '../config'

type OnboardingStep = 'landing' | 'ask-name'

interface Props {
  config: AppConfig
  hasStoredCredential: boolean
  onRegister: (name: string) => Promise<void>
  onLogin: () => Promise<void>
  error: string | null
  loading: boolean
}

export function Onboarding({ config, hasStoredCredential, onRegister, onLogin, error, loading }: Props) {
  const [step, setStep] = useState<OnboardingStep>('landing')
  const [name, setName] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)

  // If returning user has stored credential, auto-show unlock
  useEffect(() => {
    // Nothing to do here — landing page handles both cases
  }, [hasStoredCredential])

  const handleNewIdentity = async () => {
    // First create the passkey with a temporary name, then ask for display name
    setIsNewUser(true)
    setStep('ask-name')
  }

  const handleUnlock = async () => {
    await onLogin()
    // After login, useIdentity will check if displayName exists
    // If the passkey stored credential has a displayName, we're good
  }

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onRegister(name.trim())
  }

  // Step: ask for display name (after passkey creation or if returning user has no name)
  if (step === 'ask-name') {
    return (
      <div className="onboarding">
        <div className="onboarding-content">
          <div className="onboarding-icon">👤</div>
          <h1>What's your name?</h1>
          <p className="onboarding-desc">This will be shown to your contacts.</p>

          <form onSubmit={handleNameSubmit}>
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
              {loading ? 'Creating identity…' : 'Continue →'}
            </button>
          </form>

          {error && <p className="error-msg">{error}</p>}
        </div>
      </div>
    )
  }

  // Landing page with two options
  return (
    <div className="onboarding">
      <div className="onboarding-content">
        <div className="onboarding-icon">💬</div>
        <h1>{config.title}</h1>
        <p className="onboarding-desc">{config.description}</p>

        <div className="onboarding-actions">
          {hasStoredCredential ? (
            <>
              <button
                className="btn-primary"
                onClick={handleUnlock}
                disabled={loading}
              >
                {loading ? 'Authenticating…' : '🔓 Unlock with passkey'}
              </button>
              <button
                className="btn-secondary"
                onClick={handleNewIdentity}
                disabled={loading}
              >
                Create new identity
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-primary"
                onClick={handleNewIdentity}
                disabled={loading}
              >
                Create new identity →
              </button>
              <button
                className="btn-secondary"
                onClick={handleUnlock}
                disabled={loading}
              >
                🔑 I already have a passkey
              </button>
            </>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}

        <div className="onboarding-footer">
          <p>🔒 Your messages are end-to-end encrypted.<br />No account needed. Powered by Nostr.</p>
        </div>
      </div>
    </div>
  )
}
