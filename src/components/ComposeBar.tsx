import { useState, useRef, useEffect } from 'react'
import { finalizeEvent } from 'nostr-tools'
import { type AppConfig } from '../config'
import { checkRateLimit } from '../lib/rate-limit'
import { type RelayConnection } from '../lib/nostr'

interface Props {
  config: AppConfig
  onSend: (content: string) => Promise<void>
  sending: boolean
  relay: RelayConnection | null
  privateKey: Uint8Array | null
  contactPubkeyHex: string | null
  draft?: string
  onDraftChange?: (text: string) => void
}

export function ComposeBar({ config, onSend, sending, relay, privateKey, contactPubkeyHex, draft, onDraftChange }: Props) {
  const [text, setText] = useState(draft || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingRef = useRef<number>(0)
  const rateLimit = checkRateLimit(config.rateLimits)

  // Sync from draft prop when contact changes
  const lastContactRef = useRef<string | null>(null)

  useEffect(() => {
    if (contactPubkeyHex !== lastContactRef.current) {
      const newText = draft || ''
      setText(newText)
      lastContactRef.current = contactPubkeyHex
      
      // Place cursor at end of draft
      const textarea = textareaRef.current
      if (textarea && newText) {
        requestAnimationFrame(() => {
          textarea.selectionStart = newText.length
          textarea.selectionEnd = newText.length
        })
      }
    }
  }, [draft, contactPubkeyHex])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const maxHeight = 24 * 6
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [text])

  const sendTypingIndicator = () => {
    if (!relay || !privateKey || !contactPubkeyHex) return
    
    try {
      const event = finalizeEvent(
        {
          kind: 20003,
          created_at: Math.floor(Date.now() / 1000),
          tags: [["p", contactPubkeyHex]],
          content: "",
        },
        privateKey
      )
      relay.publish(event)
    } catch (error) {
      console.error('Failed to send typing indicator:', error)
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    onDraftChange?.(newText)
    
    const now = Date.now()
    const isFirstType = lastTypingRef.current === 0 || (now - lastTypingRef.current) > 5000
    
    if (isFirstType && newText.length > 0) {
      sendTypingIndicator()
      lastTypingRef.current = now
    }
    
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
    }
    
    if (newText.length > 0) {
      typingTimerRef.current = setTimeout(() => {
        sendTypingIndicator()
        lastTypingRef.current = Date.now()
      }, 5000)
    } else {
      lastTypingRef.current = 0
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !rateLimit.canSend || sending) return
    
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }
    lastTypingRef.current = 0
    
    const msg = text.trim()
    setText('')
    onDraftChange?.('')
    await onSend(msg)
  }

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }
    }
  }, [])

  if (!rateLimit.canSend) {
    return (
      <div className="compose-bar compose-limited">
        <div className="rate-limit-msg">
          <span>⏳</span>
          <div>
            <strong>
              {rateLimit.limitReached === 'day' ? 'Daily' :
                rateLimit.limitReached === 'week' ? 'Weekly' : 'Monthly'} message limit reached
            </strong>
            <br />
            Resets in {rateLimit.resetIn}
          </div>
        </div>
      </div>
    )
  }

  return (
    <form className="compose-bar" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className="compose-input"
        placeholder="Type a message…"
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        disabled={sending}
        autoFocus
        rows={1}
      />
      <button type="submit" className="btn-send" disabled={!text.trim() || sending}>
        ↑
      </button>
      <div className="rate-limit-counter">
        {rateLimit.dayCount}/{rateLimit.dayLimit} today
      </div>
    </form>
  )
}
