import { useState, useCallback } from 'react'
import { type AppConfig, type Contact } from './config'
import { useIdentity } from './hooks/useIdentity'
import { useRelay } from './hooks/useRelay'
import { useMessages } from './hooks/useMessages'
import { npubToHex } from './lib/nip19'
import { Onboarding } from './components/Onboarding'
import { ContactList } from './components/ContactList'
import { ChatView } from './components/ChatView'
import { Settings } from './components/Settings'

type Screen = 'contacts' | 'chat' | 'settings'

interface Props {
  config: AppConfig
}

export function App({ config }: Props) {
  const { identity, loading, error, hasStoredCredential, login, register, logout } = useIdentity()
  const { relay, status } = useRelay(identity ? config.relay : null)
  const [screen, setScreen] = useState<Screen>('contacts')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const contactHex = selectedContact ? npubToHex(selectedContact.npub) : null
  const contactProtocol = selectedContact?.protocol || 'nip17'
  const { messages, sendMessage, sending } = useMessages(
    relay,
    identity?.privateKey ?? null,
    identity?.publicKeyHex ?? null,
    contactHex,
    contactProtocol
  )

  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedContact(contact)
    setScreen('chat')
  }, [])

  const handleBack = useCallback(() => {
    setScreen('contacts')
    setSelectedContact(null)
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    setScreen('contacts')
    setSelectedContact(null)
  }, [logout])

  // Not authenticated yet
  if (!identity) {
    return (
      <Onboarding
        config={config}
        hasStoredCredential={hasStoredCredential}
        onRegister={register}
        onLogin={login}
        error={error}
        loading={loading}
      />
    )
  }

  return (
    <div className="app">
      {/* Connection status indicator */}
      {status !== 'connected' && (
        <div className={`status-bar status-${status}`}>
          {status === 'connecting' ? 'Connecting…' : 'Disconnected — reconnecting…'}
        </div>
      )}

      {screen === 'contacts' && (
        <ContactList
          contacts={config.contacts}
          onSelect={handleSelectContact}
          onSettings={() => setScreen('settings')}
        />
      )}

      {screen === 'chat' && selectedContact && (
        <ChatView
          contact={selectedContact}
          messages={messages}
          config={config}
          sending={sending}
          onSend={sendMessage}
          onBack={handleBack}
        />
      )}

      {screen === 'settings' && (
        <Settings
          publicKeyHex={identity.publicKeyHex}
          displayName={identity.displayName}
          onLogout={handleLogout}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
