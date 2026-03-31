import { useState, useEffect, useRef } from 'react'
import { RelayConnection, type StatusCallback } from '../lib/nostr'

export type RelayStatus = 'connecting' | 'connected' | 'disconnected'

export function useRelay(url: string | null) {
  const [status, setStatus] = useState<RelayStatus>('disconnected')
  const relayRef = useRef<RelayConnection | null>(null)

  useEffect(() => {
    if (!url) return

    const relay = new RelayConnection(url)
    relayRef.current = relay
    relay.onStatus(setStatus)
    relay.connect()

    return () => {
      relay.disconnect()
      relayRef.current = null
    }
  }, [url])

  return { relay: relayRef.current, status }
}
