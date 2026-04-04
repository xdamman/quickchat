import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { loadConfig, type AppConfig } from './config'
import { App } from './App'
import './styles.css'

// Lock orientation to portrait when possible (installed PWA)
try {
  (screen.orientation as any)?.lock?.('portrait').catch(() => {})
} catch {}

function Root() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConfig().then(setConfig).catch(e => setError(e.message))
  }, [])

  if (error) return <div className="app-error">Failed to load config: {error}</div>
  if (!config) return <div className="app-loading">Loading…</div>

  return <App config={config} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
