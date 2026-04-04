import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseContactSpec, resolveContacts } from '../lib/nip05'

describe('parseContactSpec', () => {
  it('parses npub', () => {
    const result = parseContactSpec('npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr')
    expect(result).toEqual({ npub: 'npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr' })
  })

  it('parses user@domain NIP-05', () => {
    expect(parseContactSpec('xavier@xavierdamman.com')).toEqual({ domain: 'xavierdamman.com', name: 'xavier' })
  })

  it('parses bare domain (fetch all)', () => {
    expect(parseContactSpec('xavierdamman.com')).toEqual({ domain: 'xavierdamman.com' })
  })

  it('trims whitespace', () => {
    expect(parseContactSpec('  xavierdamman.com  ')).toEqual({ domain: 'xavierdamman.com' })
  })
})

describe('resolveContacts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves a bare npub to a contact with truncated name', async () => {
    const npub = 'npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr'
    const contacts = await resolveContacts([npub])
    expect(contacts).toHaveLength(1)
    expect(contacts[0].npub).toBe(npub)
    expect(contacts[0].name).toContain('npub1xsp9fcq')
  })

  it('resolves a NIP-05 user@domain', async () => {
    const mockResponse = {
      names: { xavier: '3404a9c009ab7a2e825c2e5fce4e8d9f60ea93363117a7c013bf6c7664d171c6' },
      relays: {}
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const contacts = await resolveContacts(['xavier@xavierdamman.com'])
    expect(contacts).toHaveLength(1)
    expect(contacts[0].name).toBe('xavier')
    expect(contacts[0].npub).toMatch(/^npub1/)
  })

  it('resolves a bare domain (all names)', async () => {
    const mockResponse = {
      names: {
        _: 'aaaa',
        xavier: '3404a9c009ab7a2e825c2e5fce4e8d9f60ea93363117a7c013bf6c7664d171c6',
        xbot: 'ff3e0c27e7fb240231b2cbf7caa03097fc38783c992f4ec2edf0b5fe2ab5d980',
      }
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const contacts = await resolveContacts(['xavierdamman.com'])
    // _ (wildcard) should be excluded
    expect(contacts).toHaveLength(2)
    expect(contacts.map(c => c.name)).toContain('xavier')
    expect(contacts.map(c => c.name)).toContain('xbot')
  })

  it('skips _ wildcard entry', async () => {
    const mockResponse = {
      names: { _: 'aaaa' }
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const contacts = await resolveContacts(['example.com'])
    expect(contacts).toHaveLength(0)
  })

  it('handles fetch failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'))
    const contacts = await resolveContacts(['broken@example.com'])
    expect(contacts).toHaveLength(0)
  })

  it('mixes npubs and NIP-05 in one call', async () => {
    const mockResponse = {
      names: { xavier: '3404a9c009ab7a2e825c2e5fce4e8d9f60ea93363117a7c013bf6c7664d171c6' },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const npub = 'npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr'
    const contacts = await resolveContacts([npub, 'xavier@xavierdamman.com'])
    expect(contacts).toHaveLength(2)
  })

  it('uses defaultProtocol', async () => {
    const npub = 'npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr'
    const contacts = await resolveContacts([npub], 'nip17')
    expect(contacts[0].protocol).toBe('nip17')
  })

  it('extracts emoji from name into avatar field', async () => {
    const mockResponse = {
      names: { 'xbot 🤖': 'ff3e0c27e7fb240231b2cbf7caa03097fc38783c992f4ec2edf0b5fe2ab5d980' },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const contacts = await resolveContacts(['xbot 🤖@example.com'])
    expect(contacts[0].avatar).toBe('🤖')
  })
})
