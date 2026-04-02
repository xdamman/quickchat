import { useState, useCallback, useEffect } from 'react'
import { registerPasskey, authenticatePasskey, getStoredCredential, clearCredential, getTrustedNsec, storeTrustedNsec, isStandalone, type PasskeyResult } from '../lib/passkey'
import { saveIdentity, getIdentity, clearAllData } from '../lib/storage'
import { clearRateLimits } from '../lib/rate-limit'
import { clearEventLog } from '../lib/event-log'
import { bytesToHex } from '@noble/hashes/utils'
import { schnorr } from '@noble/curves/secp256k1'

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

  // Always show "Unlock with passkey" — discoverable credentials work
  // without localStorage (OS passkey picker finds them by domain)
  const hasStoredCredential = true

  // Try auto-login from trusted nsec on mount
  useEffect(() => {
    const trustedKey = getTrustedNsec()
    if (trustedKey) {
      try {
        const publicKeyHex = bytesToHex(schnorr.getPublicKey(trustedKey))
        const storedName = localStorage.getItem(DISPLAY_NAME_KEY) || ''
        setIdentity({
          privateKey: trustedKey,
          publicKeyHex,
          displayName: storedName,
          prfSupported: false,
        })
      } catch {
        // Invalid key, ignore
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (trustDevice?: boolean) => {
    setError(null)
    setLoading(true)
    try {
      const result = await authenticatePasskey()
      // Check for stored display name
      const storedName = localStorage.getItem(DISPLAY_NAME_KEY)
      if (storedName) {
        result.displayName = storedName
      }
      if (trustDevice) {
        storeTrustedNsec(result.privateKey)
      }
      setIdentity(result)
    } catch (e: any) {
      setError(e.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (displayName: string, trustDevice?: boolean) => {
    setError(null)
    setLoading(true)
    try {
      const result = await registerPasskey(displayName)
      // Store display name in localStorage for persistence
      localStorage.setItem(DISPLAY_NAME_KEY, displayName)
      await saveIdentity({ displayName, pubkeyHex: result.publicKeyHex })
      if (trustDevice) {
        storeTrustedNsec(result.privateKey)
      }
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
