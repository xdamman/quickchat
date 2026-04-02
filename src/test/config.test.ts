import { describe, it, expect } from 'vitest'
import { getVisibleContacts, type AppConfig, type Contact } from '../config'

const publicContact: Contact = {
  npub: 'npub1lumcvfl8lkjquyvdjhlme4qvxhlcu0pujvfajhpmu94llwz4wesqhtld68',
  name: 'xbot',
  avatar: '',
  description: 'Dev companion',
  protocol: 'nip04',
}

const whitelistedContact: Contact = {
  npub: 'npub183zedq8yuadg43glmhree9v4gyp8fy35cgp63al7kdpkg3we0xeqqk57tf',
  name: 'xbot-coder',
  avatar: '',
  description: 'Coding agent',
  protocol: 'nip04',
}

const whitelistedNpub = 'npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr'
const nonWhitelistedNpub = 'npub1randomusernotinwhitelist000000000000000000000000000000s9kxc8y'

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    contacts: [publicContact],
    whitelistedContacts: [whitelistedContact],
    whitelist: [whitelistedNpub],
    rateLimits: { messagesPerDay: 50, messagesPerWeek: 200, messagesPerMonth: 500 },
    title: 'Test Chat',
    description: 'Test',
    ...overrides,
  }
}

describe('getVisibleContacts', () => {
  it('whitelisted npub sees public + whitelisted contacts', () => {
    const config = makeConfig()
    const contacts = getVisibleContacts(config, whitelistedNpub)

    expect(contacts).toHaveLength(2)
    expect(contacts).toContainEqual(publicContact)
    expect(contacts).toContainEqual(whitelistedContact)
  })

  it('non-whitelisted npub sees only public contacts', () => {
    const config = makeConfig()
    const contacts = getVisibleContacts(config, nonWhitelistedNpub)

    expect(contacts).toHaveLength(1)
    expect(contacts).toContainEqual(publicContact)
    expect(contacts).not.toContainEqual(whitelistedContact)
  })

  it('returns only public contacts when no whitelist is configured', () => {
    const config = makeConfig({ whitelist: undefined, whitelistedContacts: undefined })
    const contacts = getVisibleContacts(config, whitelistedNpub)

    expect(contacts).toHaveLength(1)
    expect(contacts).toContainEqual(publicContact)
  })

  it('returns only public contacts when whitelist is empty', () => {
    const config = makeConfig({ whitelist: [] })
    const contacts = getVisibleContacts(config, whitelistedNpub)

    expect(contacts).toHaveLength(1)
    expect(contacts).toContainEqual(publicContact)
  })

  it('handles empty whitelistedContacts gracefully for whitelisted user', () => {
    const config = makeConfig({ whitelistedContacts: [] })
    const contacts = getVisibleContacts(config, whitelistedNpub)

    // Whitelisted user sees public + empty whitelistedContacts = just public
    expect(contacts).toHaveLength(1)
    expect(contacts).toContainEqual(publicContact)
  })

  it('handles missing whitelistedContacts for whitelisted user', () => {
    const config = makeConfig({ whitelistedContacts: undefined })
    const contacts = getVisibleContacts(config, whitelistedNpub)

    // public + (undefined → []) = just public
    expect(contacts).toHaveLength(1)
  })

  it('multiple whitelisted npubs all get access', () => {
    const secondWhitelisted = 'npub1r4ls4h8elem9p47v0jd5k9pl4n8emtf00amc7vwzuvgd3mg4lpts4l5txl'
    const config = makeConfig({ whitelist: [whitelistedNpub, secondWhitelisted] })

    const contacts1 = getVisibleContacts(config, whitelistedNpub)
    const contacts2 = getVisibleContacts(config, secondWhitelisted)

    expect(contacts1).toHaveLength(2)
    expect(contacts2).toHaveLength(2)
  })
})
