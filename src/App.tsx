import { useState, useCallback, useEffect, useRef } from 'react'
import { type AppConfig, type Contact, getRelayUrls, getVisibleContacts } from './config'
import { useIdentity } from './hooks/useIdentity'
import { useRelay } from './hooks/useRelay'
import { useMessages } from './hooks/useMessages'
import { useKeyboardHeight } from './hooks/useKeyboardHeight'
import { npubToHex, hexToNpub } from './lib/nip19'
import { publishKind0 } from './lib/profile'
import { Onboarding } from './components/Onboarding'
import { ContactList } from './components/ContactList'
import { ChatView } from './components/ChatView'
import { Settings } from './components/Settings'
import { InstallBanner } from './components/InstallBanner'
import { ErrorBoundary } from './components/ErrorBoundary'

type Screen = 'contacts' | 'chat' | 'settings'

interface Props {
  config: AppConfig
}

const KIND0_PUBLISHED_KEY = 'quickchat:kind0Published'

export function App({ config }: Props) {
  const { identity, loading, error, hasStoredCredential, login, register, logout } = useIdentity()
  const relayUrls = identity ? getRelayUrls(config) : null
  const { relay, status } = useRelay(relayUrls)
  const [screen, setScreen] = useState<Screen>('contacts')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const kind0Published = useRef(false)

  // Determine visible contacts based on whitelist
  const userNpub = identity ? hexToNpub(identity.publicKeyHex) : ''
  const visibleContacts = identity ? getVisibleContacts(config, userNpub) : config.contacts

  // Auto-select if only one contact
  const autoSelected = useRef(false)
  useEffect(() => {
    if (identity && visibleContacts.length === 1 && !autoSelected.current && screen === 'contacts') {
      autoSelected.current = true
      setSelectedContact(visibleContacts[0])
      setScreen('chat')
    }
  }, [identity, visibleContacts, screen])

  // Publish kind:0 on first connect after registration
  useEffect(() => {
    if (!relay || !identity || kind0Published.current) return
    if (localStorage.getItem(KIND0_PUBLISHED_KEY + ':' + identity.publicKeyHex)) return

    kind0Published.current = true
    publishKind0(relay, identity.privateKey, {
      name: identity.displayName,
      display_name: identity.displayName
    })
    localStorage.setItem(KIND0_PUBLISHED_KEY + ':' + identity.publicKeyHex, '1')
  }, [relay, identity])

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
    if (visibleContacts.length === 1) {
      // Can't go back to contact list if there's only one contact
      return
    }
    setScreen('contacts')
    setSelectedContact(null)
  }, [visibleContacts.length])

  const handleLogout = useCallback(async () => {
    await logout()
    autoSelected.current = false
    kind0Published.current = false
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

  const keyboardHeight = useKeyboardHeight()
  const appStyle = keyboardHeight > 0
    ? { height: `calc(100dvh - ${keyboardHeight}px)` } as React.CSSProperties
    : undefined

  return (
    <div className="app" style={appStyle}>
      <ErrorBoundary>
        <InstallBanner />
        {/* Connection status indicator */}
        {status !== 'connected' && (
          <div className={`status-bar status-${status}`}>
            {status === 'connecting' ? 'Connecting…' : 'Disconnected — reconnecting…'}
          </div>
        )}

        {screen === 'contacts' && (
          <ContactList
            contacts={visibleContacts}
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
            relay={relay}
            onSend={sendMessage}
            onBack={handleBack}
            singleContact={visibleContacts.length === 1}
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
      </ErrorBoundary>
    </div>
  )
}
