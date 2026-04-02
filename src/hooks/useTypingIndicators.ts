import { useState, useEffect, useRef, useCallback } from 'react'
import { type RelayConnection } from '../lib/nostr'

/**
 * Subscribe to kind:20003 typing indicators for multiple contacts.
 * Returns a Set of hex pubkeys that are currently typing.
 */
export function useTypingIndicators(
  relay: RelayConnection | null,
  publicKeyHex: string | null,
  contactHexes: string[]
): Set<string> {
  const [typing, setTyping] = useState<Set<string>>(new Set())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    if (!relay || !publicKeyHex || contactHexes.length === 0) return

    const subId = relay.subscribe([{
      kinds: [20003],
      '#p': [publicKeyHex],
      authors: contactHexes,
    }], (event: any) => {
      const author = event.pubkey as string
      
      // Add to typing set
      setTyping(prev => {
        const next = new Set(prev)
        next.add(author)
        return next
      })

      // Clear existing timer for this author
      const existing = timersRef.current.get(author)
      if (existing) clearTimeout(existing)

      // Remove after 6 seconds
      const timer = setTimeout(() => {
        setTyping(prev => {
          const next = new Set(prev)
          next.delete(author)
          return next
        })
        timersRef.current.delete(author)
      }, 6000)
      timersRef.current.set(author, timer)
    })

    return () => {
      relay.unsubscribe(subId)
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current.clear()
      setTyping(new Set())
    }
  }, [relay, publicKeyHex, contactHexes.join(',')])

  return typing
}
