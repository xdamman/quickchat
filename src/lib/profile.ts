import { type RelayConnection } from './nostr'
import { finalizeEvent, type EventTemplate } from 'nostr-tools'

export interface NostrProfile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
}

const CACHE_PREFIX = 'quickchat:profiles:'

/** Get cached profile from localStorage */
export function getCachedProfile(pubkeyHex: string): NostrProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + pubkeyHex)
    if (!raw) return null
    return JSON.parse(raw) as NostrProfile
  } catch {
    return null
  }
}

/** Cache a profile in localStorage */
function cacheProfile(pubkeyHex: string, profile: NostrProfile): void {
  try {
    localStorage.setItem(CACHE_PREFIX + pubkeyHex, JSON.stringify(profile))
  } catch { /* quota exceeded, ignore */ }
}

/** Fetch kind:0 profile from relays and cache it */
export function fetchProfile(
  relay: RelayConnection,
  pubkeyHex: string,
  onProfile: (profile: NostrProfile) => void
): () => void {
  // Check cache first
  const cached = getCachedProfile(pubkeyHex)
  if (cached) {
    onProfile(cached)
    // Still fetch fresh in background
  }

  const subId = relay.subscribe(
    { kinds: [0], authors: [pubkeyHex], limit: 1 },
    (event) => {
      try {
        const profile = JSON.parse(event.content) as NostrProfile
        cacheProfile(pubkeyHex, profile)
        onProfile(profile)
      } catch { /* bad JSON */ }
      // Close sub after getting the profile
      relay.unsubscribe(subId)
    }
  )

  return () => relay.unsubscribe(subId)
}

/** Publish a kind:0 profile event */
export function publishKind0(
  relay: RelayConnection,
  privateKey: Uint8Array,
  profile: NostrProfile
): void {
  const event: EventTemplate = {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(profile)
  }
  const signed = finalizeEvent(event, privateKey)
  relay.publish(signed).catch(() => {})
}
