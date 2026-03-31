/**
 * localStorage-based raw event log.
 * Complementary to IndexedDB — stores raw signed Nostr events for portability.
 * Capped at 1000 most recent events.
 */

const STORAGE_KEY = 'quickchat:events'
const MAX_EVENTS = 1000

export interface RawNostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

export function loadEventLog(): RawNostrEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RawNostrEvent[]
  } catch {
    return []
  }
}

export function appendEvent(event: RawNostrEvent): void {
  const events = loadEventLog()
  // Deduplicate by id
  if (events.some(e => e.id === event.id)) return

  events.push(event)

  // Cap at MAX_EVENTS — keep most recent
  if (events.length > MAX_EVENTS) {
    events.sort((a, b) => a.created_at - b.created_at)
    events.splice(0, events.length - MAX_EVENTS)
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch (e) {
    console.warn('Failed to save event log to localStorage:', e)
  }
}

export function clearEventLog(): void {
  localStorage.removeItem(STORAGE_KEY)
}
