import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function gitInfo() {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim()
    const message = execSync('git log -1 --pretty=%s').toString().trim()
    const timestamp = execSync('git log -1 --pretty=%ci').toString().trim()
    return { sha, message, timestamp }
  } catch {
    return { sha: 'unknown', message: '', timestamp: '' }
  }
}

const git = gitInfo()

export default defineConfig({
  define: {
    '__GIT_SHA__': JSON.stringify(git.sha),
    '__GIT_MESSAGE__': JSON.stringify(git.message),
    '__GIT_TIMESTAMP__': JSON.stringify(git.timestamp),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'QuickChat',
        short_name: 'QuickChat',
        description: 'Encrypted chat powered by Nostr',
        theme_color: '#007AFF',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
