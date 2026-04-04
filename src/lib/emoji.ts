/**
 * Extract the first emoji from a string, if present.
 * Handles multi-codepoint emoji (flags, ZWJ sequences, skin tones, etc).
 */
export function extractEmoji(text: string): string | null {
  if (!text) return null
  // Match emoji: covers most emoji including ZWJ sequences, flags, keycaps, skin tones
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/u
  const match = text.match(emojiRegex)
  return match ? match[0] : null
}
