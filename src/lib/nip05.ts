import { hexToNpub } from './nip19'
import { type Contact, type ContactProtocol } from '../config'
import { extractEmoji } from './emoji'

export interface Nip05Names {
  [name: string]: string  // name -> hex pubkey
}

export interface Nip05Response {
  names?: Nip05Names
  relays?: { [hex: string]: string[] }
}

/**
 * Fetch /.well-known/nostr.json from a domain.
 * If `name` is provided, fetches for that specific name. Otherwise fetches all.
 */
export async function fetchNip05(domain: string, name?: string): Promise<Nip05Response> {
  const url = name
    ? `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`
    : `https://${domain}/.well-known/nostr.json`
  const res = await fetch(url, { redirect: 'manual' })
  if (!res.ok) throw new Error(`NIP-05 fetch failed: ${res.status}`)
  return res.json()
}

/**
 * Parse a contact specifier string into a domain + optional name.
 * Formats:
 *   "user@domain.com"  -> { domain: "domain.com", name: "user" }
 *   "domain.com"       -> { domain: "domain.com" }  (fetch all)
 *   "npub1..."         -> { npub: "npub1..." }
 */
export function parseContactSpec(spec: string): { domain: string; name?: string } | { npub: string } {
  spec = spec.trim()
  if (spec.startsWith('npub1')) {
    return { npub: spec }
  }
  if (spec.includes('@')) {
    const [name, domain] = spec.split('@')
    return { domain, name }
  }
  // Just a domain — fetch all names
  return { domain: spec }
}

/**
 * Resolve a list of contact specifiers into Contact objects.
 * Fetches NIP-05 nostr.json as needed. Falls back to npub with pubkey as name.
 */
export async function resolveContacts(
  specs: string[],
  defaultProtocol: ContactProtocol = 'nip04'
): Promise<Contact[]> {
  const contacts: Contact[] = []
  // Batch by domain to avoid duplicate fetches
  const domainCache = new Map<string, Nip05Response>()

  for (const spec of specs) {
    const parsed = parseContactSpec(spec)

    if ('npub' in parsed) {
      contacts.push({
        npub: parsed.npub,
        name: parsed.npub.slice(0, 12) + '…',
        avatar: '',
        description: '',
        protocol: defaultProtocol,
      })
      continue
    }

    const { domain, name } = parsed
    let nip05: Nip05Response

    try {
      if (!domainCache.has(domain)) {
        // If we want a specific name, fetch just that; if domain-only, fetch all
        const data = await fetchNip05(domain, name)
        if (!name) domainCache.set(domain, data)  // cache domain-wide fetches
        nip05 = data
      } else {
        nip05 = domainCache.get(domain)!
      }
    } catch (e) {
      console.warn(`Failed to fetch NIP-05 for ${spec}:`, e)
      continue
    }

    if (!nip05.names) continue

    const entries = name
      ? (nip05.names[name] ? [[name, nip05.names[name]]] : [])
      : Object.entries(nip05.names).filter(([n]) => n !== '_')  // skip wildcard

    for (const [entryName, hexPubkey] of entries) {
      const npub = hexToNpub(hexPubkey as string)
      const displayName = entryName === '_' ? domain : entryName
      const emoji = extractEmoji(displayName)

      contacts.push({
        npub,
        name: displayName,
        avatar: emoji || '',
        description: '',
        protocol: defaultProtocol,
      })
    }
  }

  return contacts
}
