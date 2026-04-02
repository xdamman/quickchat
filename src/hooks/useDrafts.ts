import { useState, useCallback } from 'react'

const DRAFTS_KEY = 'quickchat:drafts'

function loadDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveDrafts(drafts: Record<string, string>): void {
  // Only keep non-empty drafts
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(drafts)) {
    if (v.trim()) clean[k] = v
  }
  if (Object.keys(clean).length > 0) {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(clean))
  } else {
    localStorage.removeItem(DRAFTS_KEY)
  }
}

/**
 * Per-contact draft messages, persisted to localStorage.
 * Returns [getDraft, setDraft, clearDraft] functions keyed by contact hex pubkey.
 */
export function useDrafts() {
  const [drafts, setDraftsState] = useState<Record<string, string>>(loadDrafts)

  const getDraft = useCallback((contactHex: string): string => {
    return drafts[contactHex] || ''
  }, [drafts])

  const setDraft = useCallback((contactHex: string, text: string) => {
    setDraftsState(prev => {
      const next = { ...prev, [contactHex]: text }
      saveDrafts(next)
      return next
    })
  }, [])

  const clearDraft = useCallback((contactHex: string) => {
    setDraftsState(prev => {
      const next = { ...prev }
      delete next[contactHex]
      saveDrafts(next)
      return next
    })
  }, [])

  return { getDraft, setDraft, clearDraft }
}
