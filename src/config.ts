import { resolveContacts } from './lib/nip05'

export type ContactProtocol = 'nip04' | 'nip17'

export interface Contact {
  npub: string
  name: string
  avatar: string
  description: string
  protocol?: ContactProtocol
}

export interface RateLimits {
  messagesPerDay: number
  messagesPerWeek: number
  messagesPerMonth: number
}

/**
 * Config as written in config.json.
 *
 * `contacts` can be:
 *   - A string: NIP-05 ("user@domain.com"), domain ("domain.com"), or npub
 *   - An array of strings (mix of NIP-05, domain, npub)
 *   - An array of Contact objects (legacy format)
 *
 * `whitelistedContacts` follows the same rules (only shown to whitelisted npubs).
 */
export interface RawConfig {
  relay?: string
  relays?: string[]
  contacts: string | string[] | Contact[]
  whitelistedContacts?: string | string[] | Contact[]
  whitelist?: string[]
  rateLimits: RateLimits
  nip05Domain?: string
  title: string
  description: string
  defaultProtocol?: ContactProtocol
}

export interface AppConfig {
  relay?: string
  relays?: string[]
  contacts: Contact[]
  whitelistedContacts?: Contact[]
  whitelist?: string[]
  rateLimits: RateLimits
  nip05Domain?: string
  title: string
  description: string
}

function isContactObject(item: unknown): item is Contact {
  return typeof item === 'object' && item !== null && 'npub' in item && 'name' in item
}

function isContactArray(arr: unknown): arr is Contact[] {
  return Array.isArray(arr) && arr.length > 0 && isContactObject(arr[0])
}

/**
 * Resolve a contacts field (string | string[] | Contact[]) into Contact[].
 */
async function resolveContactsField(
  field: string | string[] | Contact[] | undefined,
  defaultProtocol: ContactProtocol
): Promise<Contact[]> {
  if (!field) return []
  // Already resolved Contact objects
  if (isContactArray(field)) return field
  // Single string
  if (typeof field === 'string') return resolveContacts([field], defaultProtocol)
  // Array of strings
  if (Array.isArray(field) && field.length > 0 && typeof field[0] === 'string') {
    return resolveContacts(field as string[], defaultProtocol)
  }
  return []
}

/** Return contacts visible to a given user npub */
export function getVisibleContacts(config: AppConfig, userNpub: string): Contact[] {
  const isWhitelisted = config.whitelist?.includes(userNpub) ?? false
  if (isWhitelisted) {
    return [...config.contacts, ...(config.whitelistedContacts || [])]
  }
  return config.contacts
}

/** Return the list of relay URLs from config (supports both `relay` and `relays` fields) */
export function getRelayUrls(config: AppConfig): string[] {
  if (config.relays && config.relays.length > 0) return config.relays
  if (config.relay) return [config.relay]
  return []
}

let _config: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (_config) return _config

  const res = await fetch('/config.json')
  if (!res.ok) throw new Error('Failed to load config.json')
  const raw = (await res.json()) as RawConfig

  const defaultProtocol = raw.defaultProtocol || 'nip04'

  const [contacts, whitelistedContacts] = await Promise.all([
    resolveContactsField(raw.contacts, defaultProtocol),
    resolveContactsField(raw.whitelistedContacts, defaultProtocol),
  ])

  _config = {
    relay: raw.relay,
    relays: raw.relays,
    contacts,
    whitelistedContacts,
    whitelist: raw.whitelist,
    rateLimits: raw.rateLimits,
    nip05Domain: raw.nip05Domain,
    title: raw.title,
    description: raw.description,
  }

  return _config
}

export function getConfig(): AppConfig {
  if (!_config) throw new Error('Config not loaded yet')
  return _config
}
