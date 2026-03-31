import { useState, useEffect, useCallback, useRef } from 'react'
import { type RelayConnection } from '../lib/nostr'
import { createGiftWrappedDM, decryptGiftWrappedDM, createNip04DM, decryptNip04DM } from '../lib/crypto'
import { saveMessage, getMessages, updateDeliveryStatus, type StoredMessage, type DeliveryStatus } from '../lib/storage'
import { appendEvent } from '../lib/event-log'
import { recordMessage } from '../lib/rate-limit'
import { type VerifiedEvent } from 'nostr-tools'
import { type ContactProtocol } from '../config'

export function useMessages(
  relay: RelayConnection | null,
  privateKey: Uint8Array | null,
  publicKeyHex: string | null,
  contactPubkeyHex: string | null,
  contactProtocol: ContactProtocol = 'nip17'
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

  // Listen for OK responses to update delivery status
  useEffect(() => {
    if (!relay) return

    const handleOk = (eventId: string, accepted: boolean) => {
      if (!accepted) return
      // Update in IndexedDB
      updateDeliveryStatus(eventId, 'confirmed').catch(() => {})
      // Update in UI state
      setMessages(prev =>
        prev.map(m =>
          m.id === eventId ? { ...m, deliveryStatus: 'confirmed' as DeliveryStatus } : m
        )
      )
    }

    relay.onOk(handleOk)
    return () => {
      relay.onOk(() => {}) // clear callback
    }
  }, [relay])

  // Subscribe to incoming DMs (both NIP-17 gift wraps and NIP-04)
  useEffect(() => {
    if (!relay || !privateKey || !publicKeyHex) return

    // Subscribe to both kind:1059 (NIP-17 gift wraps) and kind:4 (NIP-04 DMs)
    const filters = [
      { '#p': [publicKeyHex], kinds: [1059] },
      { '#p': [publicKeyHex], kinds: [4] },
      { authors: [publicKeyHex], kinds: [4] } // our own NIP-04 messages
    ]

    const subId = relay.subscribe(
      filters,
      async (event: VerifiedEvent) => {
        if (seenIds.current.has(event.id)) return
        seenIds.current.add(event.id)

        // Log raw event
        appendEvent(event as any)

        let msg: StoredMessage | null = null

        if (event.kind === 1059) {
          // NIP-17 gift-wrapped DM
          const dm = decryptGiftWrappedDM(event, privateKey)
          if (!dm) return

          msg = {
            id: event.id,
            contactPubkey: dm.senderPubkey === publicKeyHex
              ? (event.tags.find(t => t[0] === 'p')?.[1] || dm.senderPubkey)
              : dm.senderPubkey,
            content: dm.content,
            senderPubkey: dm.senderPubkey,
            createdAt: dm.createdAt,
            isMine: dm.senderPubkey === publicKeyHex,
            deliveryStatus: 'confirmed'
          }
        } else if (event.kind === 4) {
          // NIP-04 DM
          const dm = await decryptNip04DM(event, privateKey, publicKeyHex)
          if (!dm) return

          const isMine = event.pubkey === publicKeyHex
          const contactPubkey = isMine
            ? (event.tags.find(t => t[0] === 'p')?.[1] || '')
            : event.pubkey

          msg = {
            id: event.id,
            contactPubkey,
            content: dm.content,
            senderPubkey: dm.senderPubkey,
            createdAt: dm.createdAt,
            isMine,
            deliveryStatus: 'confirmed'
          }
        }

        if (!msg) return

        await saveMessage(msg)

        // Only update UI if this message is for the current contact
        if (contactPubkeyHex && (msg.contactPubkey === contactPubkeyHex || msg.senderPubkey === contactPubkeyHex)) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg!.id)) return prev
            return [...prev, msg!].sort((a, b) => a.createdAt - b.createdAt)
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
      let signedEvent: VerifiedEvent

      if (contactProtocol === 'nip04') {
        signedEvent = await createNip04DM(content, privateKey, contactPubkeyHex)
      } else {
        signedEvent = createGiftWrappedDM(content, privateKey, contactPubkeyHex)
      }

      // Add to UI immediately as pending
      const msg: StoredMessage = {
        id: signedEvent.id,
        contactPubkey: contactPubkeyHex,
        content,
        senderPubkey: publicKeyHex,
        createdAt: Math.floor(Date.now() / 1000),
        isMine: true,
        deliveryStatus: 'pending'
      }

      await saveMessage(msg)
      seenIds.current.add(msg.id)
      setMessages(prev => [...prev, msg])

      // Publish — relay OK handler will update to 'confirmed'
      await relay.publish(signedEvent)

      // Log raw event
      appendEvent(signedEvent as any)

      // Mark as published (sent to relay)
      const published: DeliveryStatus = 'published'
      await updateDeliveryStatus(msg.id, published)
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, deliveryStatus: published } : m)
      )

      recordMessage()
    } finally {
      setSending(false)
    }
  }, [relay, privateKey, contactPubkeyHex, publicKeyHex, contactProtocol])

  return { messages, sendMessage, sending }
}
