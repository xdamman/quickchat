import { useState, useEffect } from 'react'
import { type Contact } from '../config'
import { getLastMessage, type StoredMessage } from '../lib/storage'
import { npubToHex } from '../lib/nip19'

interface Props {
  contacts: Contact[]
  onSelect: (contact: Contact) => void
  onSettings: () => void
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function ContactList({ contacts, onSelect, onSettings }: Props) {
  const [lastMessages, setLastMessages] = useState<Map<string, StoredMessage>>(new Map())

  useEffect(() => {
    Promise.all(
      contacts.map(async c => {
        const hex = npubToHex(c.npub)
        const msg = await getLastMessage(hex)
        return [hex, msg] as const
      })
    ).then(results => {
      const map = new Map<string, StoredMessage>()
      results.forEach(([hex, msg]) => { if (msg) map.set(hex, msg) })
      setLastMessages(map)
    })
  }, [contacts])

  return (
    <div className="contact-list">
      <div className="header">
        <h1>💬 QuickChat</h1>
        <button className="btn-icon" onClick={onSettings} aria-label="Settings">⚙️</button>
      </div>
      <h2>Messages</h2>
      <div className="contacts">
        {contacts.map(contact => {
          const hex = npubToHex(contact.npub)
          const lastMsg = lastMessages.get(hex)
          return (
            <button key={contact.npub} className="contact-row" onClick={() => onSelect(contact)}>
              <div className="contact-avatar">
                {contact.avatar && !contact.avatar.startsWith('http') && !contact.avatar.startsWith('/') ? (
                  <span className="avatar-emoji">{contact.avatar}</span>
                ) : contact.avatar ? (
                  <img src={contact.avatar} alt="" />
                ) : (
                  <span className="avatar-placeholder">{contact.name[0]}</span>
                )}
              </div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-preview">
                  {lastMsg
                    ? (lastMsg.isMine ? 'You: ' : '') + lastMsg.content.slice(0, 50)
                    : contact.description || 'No messages yet'
                  }
                </div>
              </div>
              {lastMsg && <div className="contact-time">{timeAgo(lastMsg.createdAt)}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
