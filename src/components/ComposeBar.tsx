import { useState } from 'react'
import { type AppConfig } from '../config'
import { checkRateLimit } from '../lib/rate-limit'

interface Props {
  config: AppConfig
  onSend: (content: string) => Promise<void>
  sending: boolean
}

export function ComposeBar({ config, onSend, sending }: Props) {
  const [text, setText] = useState('')
  const rateLimit = checkRateLimit(config.rateLimits)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !rateLimit.canSend || sending) return
    const msg = text.trim()
    setText('')
    await onSend(msg)
  }

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
      <input
        type="text"
        className="compose-input"
        placeholder="Type a message…"
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={sending}
        autoFocus
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
