import { useState, useEffect, useRef } from 'react'
import { RelayConnection, type StatusCallback } from '../lib/nostr'

export type RelayStatus = 'connecting' | 'connected' | 'disconnected'

export function useRelay(urls: string[] | null) {
  const [status, setStatus] = useState<RelayStatus>('disconnected')
  const relayRef = useRef<RelayConnection | null>(null)

  useEffect(() => {
    if (!urls || urls.length === 0) return

    const relay = new RelayConnection(urls)
    relayRef.current = relay
    relay.onStatus(setStatus)
    relay.connect()

    return () => {
      relay.disconnect()
      relayRef.current = null
    }
  }, [urls?.join(',')])

  return { relay: relayRef.current, status }
}
