import { describe, it, expect } from 'vitest'
import { extractEmoji } from '../lib/emoji'

describe('extractEmoji', () => {
  it('returns null for empty string', () => {
    expect(extractEmoji('')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(extractEmoji(null as any)).toBeNull()
    expect(extractEmoji(undefined as any)).toBeNull()
  })

  it('returns null for plain text with no emoji', () => {
    expect(extractEmoji('xbot-coder')).toBeNull()
    expect(extractEmoji('hello world')).toBeNull()
    expect(extractEmoji('ABC 123')).toBeNull()
  })

  // These are the actual agent names from config
  it('extracts 🛠️ from "xbot-coder 🛠️"', () => {
    expect(extractEmoji('xbot-coder 🛠️')).toBe('🛠️')
  })

  it('extracts 🔧 from "xbot-devops 🔧"', () => {
    expect(extractEmoji('xbot-devops 🔧')).toBe('🔧')
  })

  it('extracts 🧪 from "xbot-test 🧪"', () => {
    expect(extractEmoji('xbot-test 🧪')).toBe('🧪')
  })

  it('extracts 🎬 from "xbot-presenter 🎬"', () => {
    expect(extractEmoji('xbot-presenter 🎬')).toBe('🎬')
  })

  it('extracts 💻 from "chb-cli 💻"', () => {
    expect(extractEmoji('chb-cli 💻')).toBe('💻')
  })

  it('extracts 🌐 from "chb-api 🌐"', () => {
    expect(extractEmoji('chb-api 🌐')).toBe('🌐')
  })

  it('extracts ⚡ from "xbot-nostr ⚡"', () => {
    expect(extractEmoji('xbot-nostr ⚡')).toBe('⚡')
  })

  it('extracts ✍️ from "xbot-writer ✍️"', () => {
    expect(extractEmoji('xbot-writer ✍️')).toBe('✍️')
  })

  it('extracts 📜 from "xbot-openletter 📜"', () => {
    expect(extractEmoji('xbot-openletter 📜')).toBe('📜')
  })

  it('extracts 🤖 from "xbot 🤖"', () => {
    expect(extractEmoji('xbot 🤖')).toBe('🤖')
  })

  it('extracts 👨‍💻 from "Xavier 👨‍💻" (ZWJ sequence)', () => {
    expect(extractEmoji('Xavier 👨‍💻')).toBe('👨‍💻')
  })

  it('extracts emoji at start of string', () => {
    expect(extractEmoji('🔥 hot')).toBe('🔥')
  })

  it('extracts first emoji when multiple present', () => {
    const result = extractEmoji('hello 🎉 world 🌍')
    expect(result).toBe('🎉')
  })

  // Digits and # * should NOT match as emoji
  it('does not match plain digits as emoji', () => {
    expect(extractEmoji('test 123')).toBeNull()
  })

  it('does not match # or * as emoji', () => {
    expect(extractEmoji('test #1')).toBeNull()
    expect(extractEmoji('test *')).toBeNull()
  })
})
