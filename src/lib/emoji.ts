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

const KEYWORD_AVATARS: Array<[RegExp, string]> = [
  [/open\s*-?\s*letter|petition|letter/i, '📜'],
  [/coder|coding|code|engineer|dev/i, '🛠️'],
  [/devops|infra|ops|sre|sysadmin/i, '🔧'],
  [/test|qa|spec/i, '🧪'],
  [/present|video|deck|slides/i, '🎬'],
  [/cli|terminal|shell/i, '💻'],
  [/api|server|web|site|www/i, '🌐'],
  [/nostr|relay/i, '⚡'],
  [/writer|write|blog|copy/i, '✍️'],
  [/bot|agent|assistant/i, '🤖'],
  [/human|person|xavier/i, '👨‍💻'],
]

const FALLBACK_AVATARS = ['💬', '✨', '🚀', '🌱', '🧭', '💡', '🎯', '🔮', '📣', '🪄', '🌟', '🦄']

function stableIndex(text: string, modulo: number): number {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return hash % modulo
}

/**
 * Return an emoji avatar for a contact label.
 *
 * Priority:
 * 1. An explicit emoji embedded in the label.
 * 2. A semantic default for common agent/contact roles.
 * 3. A stable, deterministic generic emoji so NIP-05 domain contacts never
 *    regress to initial-letter placeholders just because nostr.json has no
 *    avatar metadata field.
 */
export function defaultEmojiAvatar(label: string): string {
  const explicit = extractEmoji(label)
  if (explicit) return explicit

  for (const [pattern, avatar] of KEYWORD_AVATARS) {
    if (pattern.test(label)) return avatar
  }

  return FALLBACK_AVATARS[stableIndex(label.toLowerCase(), FALLBACK_AVATARS.length)]
}
