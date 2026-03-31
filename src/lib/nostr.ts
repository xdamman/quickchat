import { type VerifiedEvent } from 'nostr-tools'

export type SubCallback = (event: VerifiedEvent) => void
export type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected') => void
export type OkCallback = (eventId: string, accepted: boolean, message: string) => void

class SingleRelay {
  private ws: WebSocket | null = null
  private url: string
  private subs = new Map<string, SubCallback>()
  private okCb: OkCallback | null = null
  private onStatusChange: ((url: string, connected: boolean) => void) | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldConnect = false
  private pendingRequests: unknown[][] = []

  constructor(url: string) {
    this.url = url
  }

  onOk(cb: OkCallback) { this.okCb = cb }
  onStatus(cb: (url: string, connected: boolean) => void) { this.onStatusChange = cb }

  connect() {
    this.shouldConnect = true
    this._connect()
  }

  private _connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.onStatusChange?.(this.url, true)
      for (const req of this.pendingRequests) {
        this.ws?.send(JSON.stringify(req))
      }
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg[0] === 'EVENT' && msg[1] && msg[2]) {
          this.subs.get(msg[1] as string)?.(msg[2] as VerifiedEvent)
        } else if (msg[0] === 'OK' && msg[1]) {
          this.okCb?.(msg[1] as string, msg[2] as boolean, (msg[3] as string) || '')
        }
      } catch { /* ignore */ }
    }

    this.ws.onclose = () => {
      this.onStatusChange?.(this.url, false)
      if (this.shouldConnect) this.scheduleReconnect()
    }

    this.ws.onerror = () => { this.ws?.close() }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.shouldConnect) this._connect()
    }, 3000)
  }

  subscribe(subId: string, filters: unknown[], cb: SubCallback) {
    this.subs.set(subId, cb)
    const req = ['REQ', subId, ...filters]
    this.pendingRequests.push(req)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(req))
    }
  }

  unsubscribe(subId: string) {
    this.subs.delete(subId)
    this.pendingRequests = this.pendingRequests.filter(r => r[1] !== subId)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(['CLOSE', subId]))
    }
  }

  publish(event: VerifiedEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(['EVENT', event]))
    }
  }

  get isConnected() { return this.ws?.readyState === WebSocket.OPEN }

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

/**
 * Multi-relay connection manager.
 * Subscribes on all relays, publishes to all relays, deduplicates incoming events.
 */
export class RelayConnection {
  private relays: SingleRelay[] = []
  private statusCb: StatusCallback | null = null
  private okCb: OkCallback | null = null
  private connectedSet = new Set<string>()
  private subCounter = 0

  constructor(urls: string | string[]) {
    const urlList = Array.isArray(urls) ? urls : [urls]
    for (const url of urlList) {
      const r = new SingleRelay(url)
      r.onStatus((u, connected) => {
        if (connected) this.connectedSet.add(u)
        else this.connectedSet.delete(u)
        this.updateStatus()
      })
      r.onOk((eventId, accepted, message) => {
        this.okCb?.(eventId, accepted, message)
      })
      this.relays.push(r)
    }
  }

  private updateStatus() {
    if (this.connectedSet.size > 0) this.statusCb?.('connected')
    else if (this.relays.length > 0) this.statusCb?.('connecting')
    else this.statusCb?.('disconnected')
  }

  onStatus(cb: StatusCallback) { this.statusCb = cb }
  onOk(cb: OkCallback) {
    this.okCb = cb
    for (const r of this.relays) r.onOk(cb)
  }

  connect() {
    for (const r of this.relays) r.connect()
  }

  subscribe(filters: Record<string, unknown> | Record<string, unknown>[], cb: SubCallback): string {
    const subId = `sub_${++this.subCounter}`
    const filterArr = Array.isArray(filters) ? filters : [filters]
    for (const r of this.relays) {
      r.subscribe(subId, filterArr, cb)
    }
    return subId
  }

  unsubscribe(subId: string) {
    for (const r of this.relays) r.unsubscribe(subId)
  }

  publish(event: VerifiedEvent): Promise<string> {
    let anyConnected = false
    for (const r of this.relays) {
      if (r.isConnected) {
        r.publish(event)
        anyConnected = true
      }
    }
    if (!anyConnected) return Promise.reject(new Error('Not connected to any relay'))
    return Promise.resolve(event.id)
  }

  disconnect() {
    for (const r of this.relays) r.disconnect()
    this.connectedSet.clear()
  }
}
