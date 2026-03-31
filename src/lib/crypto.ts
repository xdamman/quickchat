import * as nip44 from 'nostr-tools/nip44'
import { finalizeEvent, type EventTemplate, type VerifiedEvent } from 'nostr-tools'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { schnorr } from '@noble/curves/secp256k1'

/**
 * Create a NIP-17 gift-wrapped DM.
 *
 * Layers:
 *   kind:14 (DM) → kind:1060 (Seal) → kind:1059 (Gift Wrap)
 */
export function createGiftWrappedDM(
  content: string,
  senderPrivkey: Uint8Array,
  recipientPubkeyHex: string
): VerifiedEvent {
  const senderPubkeyHex = bytesToHex(schnorr.getPublicKey(senderPrivkey))

  // 1. Create the kind:14 DM rumor (unsigned)
  const dmEvent: EventTemplate & { pubkey: string } = {
    kind: 14,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkeyHex]],
    content,
    pubkey: senderPubkeyHex
  }

  // 2. Seal (kind:1060): encrypt the DM rumor with sender's real key
  const sealConversationKey = nip44.v2.utils.getConversationKey(senderPrivkey, recipientPubkeyHex)
  const sealedContent = nip44.v2.encrypt(JSON.stringify(dmEvent), sealConversationKey)

  const sealEvent: EventTemplate = {
    kind: 1060,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 600), // randomize timestamp
    tags: [],
    content: sealedContent
  }

  const signedSeal = finalizeEvent(sealEvent, senderPrivkey)

  // 3. Gift Wrap (kind:1059): encrypt the seal with a random ephemeral key
  const ephemeralPrivkey = crypto.getRandomValues(new Uint8Array(32))
  const wrapConversationKey = nip44.v2.utils.getConversationKey(ephemeralPrivkey, recipientPubkeyHex)
  const wrappedContent = nip44.v2.encrypt(JSON.stringify(signedSeal), wrapConversationKey)

  const giftWrapEvent: EventTemplate = {
    kind: 1059,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 600),
    tags: [['p', recipientPubkeyHex]],
    content: wrappedContent
  }

  return finalizeEvent(giftWrapEvent, ephemeralPrivkey)
}

/**
 * Decrypt an incoming NIP-17 gift-wrapped DM.
 *
 * Returns the inner kind:14 event or null if decryption fails.
 */
export function decryptGiftWrappedDM(
  giftWrap: VerifiedEvent,
  recipientPrivkey: Uint8Array
): { content: string; senderPubkey: string; createdAt: number } | null {
  try {
    // 1. Unwrap the gift wrap (encrypted with ephemeral key → recipient)
    const wrapConversationKey = nip44.v2.utils.getConversationKey(recipientPrivkey, giftWrap.pubkey)
    const sealJson = nip44.v2.decrypt(giftWrap.content, wrapConversationKey)
    const seal = JSON.parse(sealJson)

    if (seal.kind !== 1060) return null

    // 2. Unseal (encrypted with sender's real key → recipient)
    const sealConversationKey = nip44.v2.utils.getConversationKey(recipientPrivkey, seal.pubkey)
    const dmJson = nip44.v2.decrypt(seal.content, sealConversationKey)
    const dm = JSON.parse(dmJson)

    if (dm.kind !== 14) return null

    return {
      content: dm.content,
      senderPubkey: dm.pubkey || seal.pubkey,
      createdAt: dm.created_at
    }
  } catch (e) {
    console.warn('Failed to decrypt gift-wrapped DM:', e)
    return null
  }
}
