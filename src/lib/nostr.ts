import { type VerifiedEvent } from 'nostr-tools'

export type SubCallback = (event: VerifiedEvent) => void
export type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected') => void
export type OkCallback = (eventId: string, accepted: boolean, message: string) => void

export class RelayConnection {
  private ws: WebSocket | null = null
  private url: string
  private subs = new Map<string, SubCallback>()
  private statusCb: StatusCallback | null = null
  private okCb: OkCallback | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldConnect = false
  private subCounter = 0
  private pendingRequests: unknown[][] = []

  constructor(url: string) {
    this.url = url
  }

  onStatus(cb: StatusCallback) {
    this.statusCb = cb
  }

  onOk(cb: OkCallback) {
    this.okCb = cb
  }

  connect() {
    this.shouldConnect = true
    this._connect()
  }

  private _connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.statusCb?.('connecting')

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.statusCb?.('connected')
      // Re-send pending subscriptions
      for (const req of this.pendingRequests) {
        this.ws?.send(JSON.stringify(req))
      }
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg[0] === 'EVENT' && msg[1] && msg[2]) {
          const subId = msg[1] as string
          const event = msg[2] as VerifiedEvent
          this.subs.get(subId)?.(event)
        } else if (msg[0] === 'OK' && msg[1]) {
          // ["OK", event_id, true/false, "message"]
          const eventId = msg[1] as string
          const accepted = msg[2] as boolean
          const message = (msg[3] as string) || ''
          this.okCb?.(eventId, accepted, message)
        }
      } catch { /* ignore parse errors */ }
    }

    this.ws.onclose = () => {
      this.statusCb?.('disconnected')
      if (this.shouldConnect) this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.shouldConnect) this._connect()
    }, 3000)
  }

  subscribe(filters: Record<string, unknown> | Record<string, unknown>[], cb: SubCallback): string {
    const subId = `sub_${++this.subCounter}`
    this.subs.set(subId, cb)
    const req = Array.isArray(filters) ? ['REQ', subId, ...filters] : ['REQ', subId, filters]
    this.pendingRequests.push(req)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(req))
    }
    return subId
  }

  unsubscribe(subId: string) {
    this.subs.delete(subId)
    this.pendingRequests = this.pendingRequests.filter(r => r[1] !== subId)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(['CLOSE', subId]))
    }
  }

  publish(event: VerifiedEvent): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to relay'))
        return
      }
      this.ws.send(JSON.stringify(['EVENT', event]))
      // Return the event id — caller tracks OK via onOk callback
      resolve(event.id)
    })
  }

  disconnect() {
    this.shouldConnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }
}
