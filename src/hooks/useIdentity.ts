import { useState, useCallback, useEffect } from 'react'
import { registerPasskey, authenticatePasskey, getStoredCredential, clearCredential, type PasskeyResult } from '../lib/passkey'
import { saveIdentity, getIdentity, clearAllData } from '../lib/storage'
import { clearRateLimits } from '../lib/rate-limit'
import { clearEventLog } from '../lib/event-log'

const DISPLAY_NAME_KEY = 'quickchat:displayName'

export interface Identity {
  privateKey: Uint8Array
  publicKeyHex: string
  displayName: string
  prfSupported: boolean
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasStoredCredential = getStoredCredential() !== null

  // Try to authenticate with existing credential on mount
  useEffect(() => {
    if (!hasStoredCredential) {
      setLoading(false)
      return
    }
    // Don't auto-authenticate — user needs to click to trigger biometric
    setLoading(false)
  }, [hasStoredCredential])

  const login = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const result = await authenticatePasskey()
      // Check for stored display name
      const storedName = localStorage.getItem(DISPLAY_NAME_KEY)
      if (storedName) {
        result.displayName = storedName
      }
      setIdentity(result)
    } catch (e: any) {
      setError(e.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (displayName: string) => {
    setError(null)
    setLoading(true)
    try {
      const result = await registerPasskey(displayName)
      // Store display name in localStorage for persistence
      localStorage.setItem(DISPLAY_NAME_KEY, displayName)
      await saveIdentity({ displayName, pubkeyHex: result.publicKeyHex })
      setIdentity(result)
    } catch (e: any) {
      setError(e.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    clearCredential()
    clearRateLimits()
    clearEventLog()
    localStorage.removeItem(DISPLAY_NAME_KEY)
    await clearAllData()
    setIdentity(null)
  }, [])

  return { identity, loading, error, hasStoredCredential, login, register, logout }
}
