import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatView } from '../components/ChatView'
import { npubToHex } from '../lib/nip19'
import type { AppConfig, Contact } from '../config'
import type { StoredMessage } from '../lib/storage'

const contact: Contact = {
  npub: 'npub1lumcvfl8lkjquyvdjhlme4qvxhlcu0pujvfajhpmu94llwz4wesqhtld68',
  name: 'xbot',
  avatar: '🤖',
  description: 'Fallback description',
  protocol: 'nip04',
}

const config: AppConfig = {
  contacts: [contact],
  rateLimits: {
    messagesPerDay: 50,
    messagesPerWeek: 200,
    messagesPerMonth: 500,
  },
  title: 'QuickChat',
  description: 'Test',
}

const message: StoredMessage = {
  id: 'event-id',
  contactPubkey: npubToHex(contact.npub),
  senderPubkey: npubToHex(contact.npub),
  content: 'Hello',
  createdAt: 1_700_000_000,
  isMine: false,
}

function renderChat() {
  return render(
    <ChatView
      contact={contact}
      messages={[message]}
      config={config}
      sending={false}
      relay={null}
      onSend={vi.fn().mockResolvedValue(undefined)}
      onBack={vi.fn()}
      privateKey={null}
      publicKeyHex={null}
      typingSet={new Set()}
    />,
  )
}

describe('contact profile', () => {
  beforeEach(() => {
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    localStorage.setItem(
      `quickchat:profiles:${npubToHex(contact.npub)}`,
      JSON.stringify({
        display_name: 'xbot 🤖',
        about: 'Primary dev companion. Model: OpenAI GPT-5.6 Sol.',
      }),
    )
  })

  it('opens the kind-0 profile from the top bar', async () => {
    renderChat()

    const profileButtons = await screen.findAllByRole('button', {
      name: "View xbot's profile",
    })
    fireEvent.click(profileButtons[0])

    expect(screen.getByRole('heading', { name: 'xbot 🤖' })).toBeInTheDocument()
    expect(
      screen.getByText('Primary dev companion. Model: OpenAI GPT-5.6 Sol.'),
    ).toBeInTheDocument()
    expect(screen.getByText(contact.npub)).toBeInTheDocument()
  })

  it('opens the same profile from the message avatar', async () => {
    renderChat()

    const profileButtons = await screen.findAllByRole('button', {
      name: "View xbot's profile",
    })
    fireEvent.click(profileButtons[1])

    expect(screen.getByRole('heading', { name: 'xbot 🤖' })).toBeInTheDocument()
    expect(
      screen.getByText('Primary dev companion. Model: OpenAI GPT-5.6 Sol.'),
    ).toBeInTheDocument()
  })
})
