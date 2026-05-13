import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComposeBar } from '../components/ComposeBar'
import { type AppConfig } from '../config'

const config: AppConfig = {
  contacts: [],
  rateLimits: { messagesPerDay: 50, messagesPerWeek: 200, messagesPerMonth: 500 },
  title: 'QuickChat',
  description: 'Test chat',
}

function renderComposeBar(overrides?: Partial<React.ComponentProps<typeof ComposeBar>>) {
  const onSend = vi.fn().mockResolvedValue(undefined)
  const onDraftChange = vi.fn()

  render(
    <ComposeBar
      config={config}
      onSend={onSend}
      sending={false}
      relay={null}
      privateKey={null}
      contactPubkeyHex={null}
      onDraftChange={onDraftChange}
      {...overrides}
    />
  )

  return {
    input: screen.getByPlaceholderText('Type a message…') as HTMLTextAreaElement,
    onSend,
    onDraftChange,
  }
}

describe('ComposeBar keyboard shortcuts', () => {
  it('sends the message on Cmd+Enter', () => {
    const { input, onSend } = renderComposeBar()

    fireEvent.change(input, { target: { value: 'hello from keyboard' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', metaKey: true })

    expect(onSend).toHaveBeenCalledWith('hello from keyboard')
  })

  it('sends the message on Ctrl+Enter for non-Mac keyboards', () => {
    const { input, onSend } = renderComposeBar()

    fireEvent.change(input, { target: { value: 'hello from ctrl' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', ctrlKey: true })

    expect(onSend).toHaveBeenCalledWith('hello from ctrl')
  })

  it('does not send the message on Shift+Enter so the textarea can insert a newline', () => {
    const { input, onSend } = renderComposeBar()

    fireEvent.change(input, { target: { value: 'line one' } })
    const event = fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true })

    expect(event).toBe(true)
    expect(onSend).not.toHaveBeenCalled()
  })
})
