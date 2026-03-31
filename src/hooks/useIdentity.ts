import { useState, useCallback, useEffect } from 'react'
import { registerPasskey, authenticatePasskey, getStoredCredential, clearCredential, type PasskeyResult } from '../lib/passkey'
import { saveIdentity, getIdentity, clearAllData } from '../lib/storage'
import { clearRateLimits } from '../lib/rate-limit'

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
    await clearAllData()
    setIdentity(null)
  }, [])

  return { identity, loading, error, hasStoredCredential, login, register, logout }
}
