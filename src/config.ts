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

export interface AppConfig {
  relay: string
  contacts: Contact[]
  rateLimits: RateLimits
  nip05Domain?: string
  title: string
  description: string
}

let _config: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (_config) return _config
  const res = await fetch('/config.json')
  if (!res.ok) throw new Error('Failed to load config.json')
  _config = (await res.json()) as AppConfig
  return _config
}

export function getConfig(): AppConfig {
  if (!_config) throw new Error('Config not loaded yet')
  return _config
}
