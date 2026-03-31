import { useEffect, useRef } from 'react'
import { type Contact, type AppConfig } from '../config'
import { type StoredMessage } from '../lib/storage'
import { ComposeBar } from './ComposeBar'

interface Props {
  contact: Contact
  messages: StoredMessage[]
  config: AppConfig
  sending: boolean
  onSend: (content: string) => Promise<void>
  onBack: () => void
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

export function ChatView({ contact, messages, config, sending, onSend, onBack }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Group messages by date
  let lastDate = ''

  return (
    <div className="chat-view">
      <div className="chat-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <span className="chat-contact-name">{contact.name}</span>
        <span className="chat-lock">🔒</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>No messages yet. Say hi!</p>
          </div>
        )}
        {messages.map(msg => {
          const dateLabel = formatDate(msg.createdAt)
          const showDate = dateLabel !== lastDate
          lastDate = dateLabel
          return (
            <div key={msg.id}>
              {showDate && <div className="chat-date-separator">{dateLabel}</div>}
              <div className={`chat-bubble ${msg.isMine ? 'mine' : 'theirs'}`}>
                <div className="bubble-content">{msg.content}</div>
                <div className="bubble-meta">
                  <span className="bubble-time">{formatTime(msg.createdAt)}</span>
                  {msg.isMine && <DeliveryTicks status={msg.deliveryStatus} />}
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
