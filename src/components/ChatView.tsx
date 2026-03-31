import { useEffect, useRef, useState } from 'react'
import { type Contact, type AppConfig } from '../config'
import { type StoredMessage } from '../lib/storage'
import { type RelayConnection } from '../lib/nostr'
import { fetchProfile, getCachedProfile, type NostrProfile } from '../lib/profile'
import { npubToHex } from '../lib/nip19'
import { ComposeBar } from './ComposeBar'

interface Props {
  contact: Contact
  messages: StoredMessage[]
  config: AppConfig
  sending: boolean
  relay: RelayConnection | null
  onSend: (content: string) => Promise<void>
  onBack: () => void
  singleContact?: boolean
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function DeliveryTicks({ status }: { status?: string }) {
  if (!status || status === 'pending') return null
  if (status === 'published') return <span className="delivery-ticks">✓</span>
  if (status === 'confirmed') return <span className="delivery-ticks confirmed">✓✓</span>
  return null
}

export function ChatView({ contact, messages, config, sending, relay, onSend, onBack, singleContact }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Fetch contact's kind:0 profile for avatar
  useEffect(() => {
    const contactHex = npubToHex(contact.npub)

    // Check cache first
    const cached = getCachedProfile(contactHex)
    if (cached?.picture) {
      setAvatarUrl(cached.picture)
    } else if (contact.avatar) {
      setAvatarUrl(contact.avatar)
    }

    // Fetch from relay
    if (relay) {
      const unsub = fetchProfile(relay, contactHex, (profile: NostrProfile) => {
        if (profile.picture) {
          setAvatarUrl(profile.picture)
        }
      })
      return unsub
    }
  }, [relay, contact.npub, contact.avatar])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Group messages by date
  let lastDate = ''

  return (
    <div className="chat-view">
      <div className="chat-header">
        {!singleContact && <button className="btn-back" onClick={onBack}>←</button>}
        <span className="chat-contact-name">{contact.name}</span>
        <span className="chat-lock">🔒</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>No messages yet. Say hi!</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const dateLabel = formatDate(msg.createdAt)
          const showDate = dateLabel !== lastDate
          lastDate = dateLabel

          // Show avatar only on first message of consecutive group from same sender
          const prevMsg = idx > 0 ? messages[idx - 1] : null
          const isFirstInGroup = !msg.isMine && (!prevMsg || prevMsg.isMine || prevMsg.senderPubkey !== msg.senderPubkey || showDate)

          return (
            <div key={msg.id}>
              {showDate && <div className="chat-date-separator">{dateLabel}</div>}
              <div className={`chat-bubble-row ${msg.isMine ? 'mine' : 'theirs'}`}>
                {!msg.isMine && (
                  <div className="chat-avatar-slot">
                    {isFirstInGroup && avatarUrl ? (
                      <img className="chat-avatar-img" src={avatarUrl} alt="" />
                    ) : isFirstInGroup ? (
                      <div className="chat-avatar-placeholder">{contact.name[0]}</div>
                    ) : (
                      <div className="chat-avatar-spacer" />
                    )}
                  </div>
                )}
                <div className={`chat-bubble ${msg.isMine ? 'mine' : 'theirs'}`}>
                  <div className="bubble-content">{msg.content}</div>
                  <div className="bubble-meta">
                    <span className="bubble-time">{formatTime(msg.createdAt)}</span>
                    {msg.isMine && <DeliveryTicks status={msg.deliveryStatus} />}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <ComposeBar
        config={config}
        onSend={onSend}
        sending={sending}
      />
    </div>
  )
}
