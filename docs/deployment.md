# Deployment Guide

## Prerequisites

- A domain (e.g., `chat.yourdomain.com`)
- A Nostr relay (your own strfry or any public relay)
- Node.js 20+ (build only — no server runtime needed)

## Quick Deploy

### 1. Clone and configure

```bash
git clone https://github.com/xdamman/quickchat
cd quickchat
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "relay": "wss://relay.yourdomain.com",
  "contacts": [
    {
      "npub": "npub1your...",
      "name": "Your Name",
      "description": "Human"
    }
  ],
  "rateLimits": {
    "messagesPerDay": 50,
    "messagesPerWeek": 200,
    "messagesPerMonth": 500
  },
  "title": "Chat with me",
  "description": "Send me a message over Nostr."
}
```

### 2. Build

```bash
npm install
npm run build
```

Output is in `dist/` — static files ready to serve.

### 3. Deploy

**Option A: Static hosting (Vercel / Cloudflare Pages / Netlify)**

```bash
# Vercel
npx vercel --prod

# Cloudflare Pages
npx wrangler pages deploy dist

# Netlify
npx netlify deploy --prod --dir=dist
```

**Option B: Self-hosted (nginx)**

```nginx
server {
    listen 443 ssl http2;
    server_name chat.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/chat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.yourdomain.com/privkey.pem;

    root /var/www/quickchat/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' wss://*.yourdomain.com wss://relay.damus.io; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

## Relay Setup (strfry)

If you want to run your own relay:

### Install strfry

```bash
# Ubuntu/Debian
apt install -y git build-essential pkg-config liblmdb-dev libflatbuffers-dev libsecp256k1-dev libzstd-dev
git clone https://github.com/hoytech/strfry.git
cd strfry
make setup-golpe
make -j$(nproc)
sudo cp strfry /usr/local/bin/
```

### Configure

```bash
mkdir -p /etc/strfry
strfry export-config > /etc/strfry/strfry.conf
```

Edit `/etc/strfry/strfry.conf`:

```
relay {
    info {
        name = "QuickChat Relay"
        description = "Private relay for QuickChat"
    }
    writePolicy {
        plugin = "/etc/strfry/policies/rate-limit.sh"
    }
}
```

### Rate Limit Policy

Copy the policy script from this repo:

```bash
cp relay/rate-limit-policy.sh /etc/strfry/policies/
chmod +x /etc/strfry/policies/rate-limit-policy.sh
```

### Systemd Service

```ini
[Unit]
Description=strfry Nostr relay
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/strfry --config /etc/strfry/strfry.conf relay
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### nginx reverse proxy for relay

```nginx
server {
    listen 443 ssl http2;
    server_name relay.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/relay.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relay.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:7777;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

## NIP-05 Setup

Add a static file at your domain's well-known path:

```bash
mkdir -p /var/www/quickchat/dist/.well-known
```

Create `.well-known/nostr.json`:

```json
{
  "names": {
    "xavier": "your_hex_pubkey_here",
    "_": "your_hex_pubkey_here"
  }
}
```

Or serve it dynamically from the rate-limit sidecar (future enhancement).

## Environment Variables

For CI/CD, you can override config values:

| Variable | Description |
|----------|-------------|
| `VITE_RELAY_URL` | Override relay WebSocket URL |
| `VITE_SITE_TITLE` | Override site title |
