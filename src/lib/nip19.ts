import { nip19 } from 'nostr-tools'

export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex)
}

export function npubToHex(npub: string): string {
  const { type, data } = nip19.decode(npub)
  if (type !== 'npub') throw new Error('Not an npub')
  return data as string
}

export function shortenNpub(npub: string): string {
  return npub.slice(0, 12) + '…' + npub.slice(-4)
}
