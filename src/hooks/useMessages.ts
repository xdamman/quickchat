import { useState, useEffect, useCallback, useRef } from 'react'
import { type RelayConnection } from '../lib/nostr'
import { createGiftWrappedDM, decryptGiftWrappedDM } from '../lib/crypto'
import { saveMessage, getMessages, type StoredMessage } from '../lib/storage'
import { recordMessage } from '../lib/rate-limit'
import { type VerifiedEvent } from 'nostr-tools'

export function useMessages(
  relay: RelayConnection | null,
  privateKey: Uint8Array | null,
  publicKeyHex: string | null,
  contactPubkeyHex: string | null
) {
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [sending, setSending] = useState(false)
  const seenIds = useRef(new Set<string>())

  // Load messages from IndexedDB
  useEffect(() => {
    if (!contactPubkeyHex) return
    getMessages(contactPubkeyHex).then(msgs => {
      setMessages(msgs)
      msgs.forEach(m => seenIds.current.add(m.id))
    })
  }, [contactPubkeyHex])

  // Subscribe to incoming gift-wrapped DMs
  useEffect(() => {
    if (!relay || !privateKey || !publicKeyHex) return

    const subId = relay.subscribe(
      { '#p': [publicKeyHex], kinds: [1059] },
      async (event: VerifiedEvent) => {
        if (seenIds.current.has(event.id)) return
        seenIds.current.add(event.id)

        const dm = decryptGiftWrappedDM(event, privateKey)
        if (!dm) return

        const msg: StoredMessage = {
          id: event.id,
          contactPubkey: dm.senderPubkey === publicKeyHex
            ? (event.tags.find(t => t[0] === 'p')?.[1] || dm.senderPubkey)
            : dm.senderPubkey,
          content: dm.content,
          senderPubkey: dm.senderPubkey,
          createdAt: dm.createdAt,
          isMine: dm.senderPubkey === publicKeyHex
        }

        await saveMessage(msg)

        // Only update UI if this message is for the current contact
        if (contactPubkeyHex && (msg.contactPubkey === contactPubkeyHex || msg.senderPubkey === contactPubkeyHex)) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg].sort((a, b) => a.createdAt - b.createdAt)
          })
        }
      }
    )

    return () => {
      relay.unsubscribe(subId)
    }
  }, [relay, privateKey, publicKeyHex, contactPubkeyHex])

  const sendMessage = useCallback(async (content: string) => {
    if (!relay || !privateKey || !contactPubkeyHex || !publicKeyHex) return

    setSending(true)
    try {
      const giftWrap = createGiftWrappedDM(content, privateKey, contactPubkeyHex)
      await relay.publish(giftWrap)
      recordMessage()

      const msg: StoredMessage = {
        id: giftWrap.id,
        contactPubkey: contactPubkeyHex,
        content,
        senderPubkey: publicKeyHex,
        createdAt: Math.floor(Date.now() / 1000),
        isMine: true
      }

      await saveMessage(msg)
      seenIds.current.add(msg.id)
      setMessages(prev => [...prev, msg])
    } finally {
      setSending(false)
    }
  }, [relay, privateKey, contactPubkeyHex, publicKeyHex])

  return { messages, sendMessage, sending }
}
