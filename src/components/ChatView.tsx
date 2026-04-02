import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { type Contact, type AppConfig } from '../config'
import { type StoredMessage } from '../lib/storage'
import { type RelayConnection } from '../lib/nostr'
import { fetchProfile, getCachedProfile, type NostrProfile } from '../lib/profile'
import { npubToHex, hexToNpub } from '../lib/nip19'
import { ComposeBar } from './ComposeBar'
import { marked } from 'marked'

// Configure marked for chat messages
marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(content: string): string {
  return marked.parse(content, { async: false }) as string
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content])
  return <div className="bubble-content markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}

interface Props {
  contact: Contact
  messages: StoredMessage[]
  config: AppConfig
  sending: boolean
  relay: RelayConnection | null
  onSend: (content: string) => Promise<void>
  onBack: () => void
  singleContact?: boolean
  privateKey: Uint8Array | null
  publicKeyHex: string | null
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

/* ========== Contact Profile Modal ========== */
function ContactProfileModal({ contact, avatarUrl, onClose }: {
  contact: Contact
  avatarUrl: string | null
  onClose: () => void
}) {
  const npub = contact.npub
  const [copied, setCopied] = useState(false)

  const copyNpub = () => {
    navigator.clipboard.writeText(npub).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        {avatarUrl ? (
          <img className="profile-avatar" src={avatarUrl} alt="" />
        ) : (
          <div className="profile-avatar-placeholder">{contact.name[0]}</div>
        )}
        <h2 className="profile-name">{contact.name}</h2>
        {contact.description && (
          <p className="profile-description">{contact.description}</p>
        )}
        <div className="profile-npub">
          <button className="npub-copy-btn" onClick={copyNpub}>
            <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{npub}</span>
            <span className="npub-copy-icon">{copied ? '✓' : '📋'}</span>
            {copied && <span className="npub-copied-text">Copied!</span>}
          </button>
        </div>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export function ChatView({ contact, messages, config, sending, relay, onSend, onBack, singleContact, privateKey, publicKeyHex }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatViewRef = useRef<HTMLDivElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Subscribe to typing indicators
  useEffect(() => {
    if (!relay || !publicKeyHex) return

    const contactHex = npubToHex(contact.npub)
    
    const subId = relay.subscribe([{
      kinds: [20003],
      "#p": [publicKeyHex],
      authors: [contactHex]
    }], (event: any) => {
      // Show typing indicator
      setIsTyping(true)
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Hide typing indicator after 6 seconds
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
      }, 6000)
    })

    return () => {
      relay.unsubscribe(subId)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [relay, publicKeyHex, contact.npub])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Swipe-left to go back (only when multiple contacts)
  useEffect(() => {
    if (singleContact) return
    const el = chatViewRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch.clientX < 40) { // start from left edge
        startX = touch.clientX
        startY = touch.clientY
        tracking = true
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = Math.abs(touch.clientY - startY)
      if (dx > 80 && dy < 100) {
        onBack()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [singleContact, onBack])

  // Group messages by date
  let lastDate = ''

  return (
    <div className="chat-view" ref={chatViewRef}>
      <div className="chat-header">
        {!singleContact && <button className="btn-back" onClick={onBack}>←</button>}
        <span className="chat-contact-name" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
          {contact.name}
        </span>
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
                  <MarkdownContent content={msg.content} />
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

      {isTyping && (
        <div className="typing-indicator">
          {contact.name} is typing<span className="typing-dots"></span>
        </div>
      )}

      <ComposeBar
        config={config}
        onSend={onSend}
        sending={sending}
        relay={relay}
        privateKey={privateKey}
        contactPubkeyHex={npubToHex(contact.npub)}
      />

      {showProfile && (
        <ContactProfileModal
          contact={contact}
          avatarUrl={avatarUrl}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  )
}
