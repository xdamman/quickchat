import { useState, useEffect } from 'react'
import { type AppConfig } from '../config'
import { isStandalone } from '../lib/passkey'

type OnboardingStep = 'landing' | 'ask-name'

type BrowserType = 'ios-safari' | 'ios-chrome' | 'android-chrome' | 'android-other' | null

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  if (isIOS) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
    return isSafari ? 'ios-safari' : 'ios-chrome'
  }
  if (isAndroid) {
    const isChrome = /Chrome/.test(ua) && !/OPR|Edge|Edg/.test(ua)
    return isChrome ? 'android-chrome' : 'android-other'
  }
  return null
}

function getInstallMessage(browser: BrowserType): string {
  switch (browser) {
    case 'ios-safari':
      return 'Tap the Share button ⬆️ then "Add to Home Screen" to install'
    case 'ios-chrome':
      return 'Open in Safari, then tap Share → "Add to Home Screen"'
    case 'android-chrome':
      return 'Tap the menu (⋮) then "Add to Home Screen"'
    case 'android-other':
      return 'Open in Chrome, then tap menu → "Add to Home Screen"'
    default:
      return 'Add to Home Screen to install as an app'
  }
}

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

interface Props {
  config: AppConfig
  hasStoredCredential: boolean
  onRegister: (name: string, trustDevice?: boolean) => Promise<void>
  onLogin: (trustDevice?: boolean) => Promise<void>
  error: string | null
  loading: boolean
}

export function Onboarding({ config, hasStoredCredential, onRegister, onLogin, error, loading }: Props) {
  const [step, setStep] = useState<OnboardingStep>('landing')
  const [name, setName] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [installed, setInstalled] = useState(false)
  const [showMobile, setShowMobile] = useState(false)
  const [browser, setBrowser] = useState<BrowserType>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    const standalone = isStandalone()
    setInstalled(standalone)
    setShowMobile(!standalone && isMobile())
    if (!standalone) setBrowser(detectBrowser())

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleNewIdentity = () => {
    setStep('ask-name')
  }

  const handleUnlock = async () => {
    await onLogin(installed ? trustDevice : false)
  }

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onRegister(name.trim(), installed ? trustDevice : false)
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    }
  }

  // Step: ask for display name
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

            {installed && (
              <label className="trust-checkbox">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={e => setTrustDevice(e.target.checked)}
                />
                <span>Trust this device <span className="trust-hint">(stay signed in for 1 week)</span></span>
              </label>
            )}

            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Creating identity…' : 'Continue →'}
            </button>
          </form>

          {error && <p className="error-msg">{error}</p>}
        </div>
      </div>
    )
  }

  // Landing page
  return (
    <div className="onboarding">
      <div className="onboarding-content">
        <div className="onboarding-icon">💬</div>
        <h1>{config.title}</h1>
        <p className="onboarding-desc">{config.description}</p>

        {installed && (
          <label className="trust-checkbox">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={e => setTrustDevice(e.target.checked)}
            />
            <span>Trust this device <span className="trust-hint">(stay signed in for 1 week)</span></span>
          </label>
        )}

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

        {showMobile && (
          <div className="install-prompt-onboarding">
            <p className="install-prompt-text">
              📱 {deferredPrompt ? 'Install the app for the best experience' : getInstallMessage(browser)}
            </p>
            {deferredPrompt && (
              <button className="btn-secondary install-prompt-btn" onClick={handleInstall}>
                Install App
              </button>
            )}
          </div>
        )}

        <div className="onboarding-footer">
          <p>🔒 Your messages are end-to-end encrypted.<br />No account needed. Powered by Nostr.</p>
        </div>
      </div>
    </div>
  )
}
