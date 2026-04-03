import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { type AppConfig, type Contact, getRelayUrls, getVisibleContacts } from './config'
import { useIdentity } from './hooks/useIdentity'
import { useRelay } from './hooks/useRelay'
import { useMessages } from './hooks/useMessages'
import { useKeyboardHeight } from './hooks/useKeyboardHeight'
import { useTypingIndicators } from './hooks/useTypingIndicators'
import { useDrafts } from './hooks/useDrafts'
import { useTheme } from './hooks/useTheme'
import { npubToHex, hexToNpub } from './lib/nip19'
import { publishKind0 } from './lib/profile'
import { Onboarding } from './components/Onboarding'
import { ContactList } from './components/ContactList'
import { ChatView } from './components/ChatView'
import { Settings } from './components/Settings'
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
  const keyboardHeight = useKeyboardHeight()
  const { theme, setTheme } = useTheme()
  const { getDraft, setDraft, clearDraft } = useDrafts()
  const [screen, setScreen] = useState<Screen>('contacts')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const kind0Published = useRef(false)

  // Determine visible contacts based on whitelist
  const userNpub = identity ? hexToNpub(identity.publicKeyHex) : ''
  const visibleContacts = identity ? getVisibleContacts(config, userNpub) : config.contacts

  // Collect all contact hex pubkeys for typing indicator subscription
  const contactHexes = useMemo(
    () => visibleContacts.map(c => npubToHex(c.npub)),
    [visibleContacts]
  )
  const typingSet = useTypingIndicators(relay, identity?.publicKeyHex ?? null, contactHexes)

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
    if (visibleContacts.length === 1) return
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

  // Wrap sendMessage to clear draft on send
  const handleSend = useCallback(async (content: string) => {
    if (contactHex) clearDraft(contactHex)
    await sendMessage(content)
  }, [sendMessage, contactHex, clearDraft])

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

  // keyboardHeight is the visible viewport height when keyboard is open, null otherwise
  const appStyle = keyboardHeight
    ? { height: `${keyboardHeight}px` } as React.CSSProperties
    : undefined

  return (
    <div className="app" style={appStyle}>
      <ErrorBoundary>
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
            typingSet={typingSet}
          />
        )}

        {screen === 'chat' && selectedContact && (
          <ChatView
            contact={selectedContact}
            messages={messages}
            config={config}
            sending={sending}
            relay={relay}
            onSend={handleSend}
            onBack={handleBack}
            singleContact={visibleContacts.length === 1}
            privateKey={identity.privateKey}
            publicKeyHex={identity.publicKeyHex}
            typingSet={typingSet}
            draft={contactHex ? getDraft(contactHex) : ''}
            onDraftChange={contactHex ? (text: string) => setDraft(contactHex, text) : undefined}
          />
        )}

        {screen === 'settings' && (
          <Settings
            publicKeyHex={identity.publicKeyHex}
            displayName={identity.displayName}
            theme={theme}
            onThemeChange={setTheme}
            onLogout={handleLogout}
            onBack={handleBack}
          />
        )}
      </ErrorBoundary>
    </div>
  )
}
