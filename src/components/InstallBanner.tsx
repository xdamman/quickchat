import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'quickchat:installBannerDismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

type BrowserType = 'ios-safari' | 'ios-chrome' | 'android-chrome' | 'android-other' | null

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)

  if (isIOS) {
    // On iOS, all browsers use WebKit but only Safari supports Add to Home Screen properly
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
    return isSafari ? 'ios-safari' : 'ios-chrome'
  }
  if (isAndroid) {
    const isChrome = /Chrome/.test(ua) && !/OPR|Edge|Edg/.test(ua)
    return isChrome ? 'android-chrome' : 'android-other'
  }
  return null
}

function getInstallMessage(browser: BrowserType): { icon: string; text: string } {
  switch (browser) {
    case 'ios-safari':
      return {
        icon: '⬆️',
        text: 'Tap the Share button then "Add to Home Screen" to install'
      }
    case 'ios-chrome':
      return {
        icon: '🧭',
        text: 'Open in Safari, then tap Share → "Add to Home Screen" to install'
      }
    case 'android-chrome':
      return {
        icon: '⋮',
        text: 'Tap the menu (⋮) then "Add to Home Screen" to install'
      }
    case 'android-other':
      return {
        icon: '📱',
        text: 'Open in Chrome, then tap menu → "Add to Home Screen" to install'
      }
    default:
      return { icon: '📱', text: 'Add to Home Screen to install' }
  }
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [browser, setBrowser] = useState<BrowserType>(null)

  useEffect(() => {
    // Don't show if already installed, not mobile, or dismissed
    if (isStandalone() || !isMobile()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    setBrowser(detectBrowser())
    setVisible(true)

    // Listen for Android Chrome's beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible) return null

  const { icon, text } = getInstallMessage(browser)

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      setVisible(false)
    }
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="install-banner">
      <div className="install-banner-content">
        <span className="install-banner-icon">{icon}</span>
        <span className="install-banner-text">{text}</span>
      </div>
      <div className="install-banner-actions">
        {deferredPrompt && (
          <button className="install-banner-btn" onClick={handleInstall}>Install</button>
        )}
        <button className="install-banner-dismiss" onClick={dismiss}>✕</button>
      </div>
    </div>
  )
}
