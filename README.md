# QuickChat

Lightweight Nostr chat PWA. Create a passkey, start chatting. No app install, no seed phrases, no extensions.

## What is this?

Deploy to `chat.yourdomain.com` and let anyone chat with you (or your AI agents) over the Nostr protocol. Users create an identity with just a name and a passkey — no nsec management, no browser extensions, no friction.

## Features

- **Passkey-based identity** — Face ID / fingerprint → Nostr keypair derived client-side via WebAuthn PRF
- **Zero server-side key management** — nsec never leaves the browser, never touches a server
- **NIP-17 private DMs** — metadata-resistant encrypted messages
- **Configurable allowlist** — control who visitors can chat with (your npub, your agents, etc.)
- **Rate limiting** — message limits per day/week/month per user
- **PWA** — installable, works offline for reading history, sub-100KB gzipped
- **Self-hostable** — one config file, deploy anywhere

## Quick Start

```bash
git clone https://github.com/xdamman/quickchat
cd quickchat
cp config.example.json config.json  # edit with your npub + relay
npm install
npm run dev
```

## Deploy

```bash
npm run build
# Serve the `dist/` folder from any static host
# Point chat.yourdomain.com at it
```

Works with: Vercel, Cloudflare Pages, Netlify, nginx, any static file server.

## Configuration

```json
{
  "relay": "wss://relay.yourdomain.com",
  "contacts": [
    {
      "npub": "npub1...",
      "name": "Xavier",
      "avatar": "https://...",
      "description": "Human"
    },
    {
      "npub": "npub1...",
      "name": "xbot",
      "avatar": "https://...",
      "description": "AI assistant"
    }
  ],
  "rateLimits": {
    "messagesPerDay": 50,
    "messagesPerWeek": 200,
    "messagesPerMonth": 500
  },
  "nip05Domain": "yourdomain.com",
  "title": "Chat with Xavier",
  "description": "Send me a message. I'll get back to you."
}
```

## How It Works

1. Visitor lands on `chat.yourdomain.com`
2. Enters a display name → creates a passkey (Face ID / fingerprint)
3. Passkey's PRF extension derives 32 deterministic bytes → secp256k1 private key
4. Browser signs Nostr events directly — no server involved in signing
5. Messages are NIP-17 encrypted DMs sent through the configured relay
6. Come back later → passkey prompt → same identity, instant resume

See [docs/architecture.md](docs/architecture.md) for the full technical breakdown.

## Tech Stack

- **Vite** + **React** + **TypeScript** — fast builds, sub-second HMR
- **nostr-tools** — Nostr protocol (events, NIP-17, NIP-44)
- **@simplewebauthn/browser** — WebAuthn passkey flow
- **@noble/curves** — secp256k1 signing (schnorr)
- **wouter** — lightweight routing (~1.5KB)
- **vite-plugin-pwa** — service worker, manifest, offline support

## Browser Support

| Browser | Passkey + PRF |
|---------|--------------|
| Chrome 116+ | ✅ |
| Safari 18+ (iOS/macOS) | ✅ |
| Android Chrome | ✅ |
| Firefox | ❌ (passkey works, PRF not yet — fallback to stored encrypted key) |

## Documentation

- [Architecture](docs/architecture.md) — system design, data flow, security model
- [Protocol](docs/protocol.md) — Nostr NIPs used, message format, encryption
- [Deployment](docs/deployment.md) — self-hosting guide, relay setup, NIP-05 config
- [Wireframes](docs/wireframes.md) — UI flow and screens

## License

MIT
