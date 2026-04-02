import { sha256 } from '@noble/hashes/sha256'
import { schnorr } from '@noble/curves/secp256k1'
import { bytesToHex } from '@noble/hashes/utils'

const PRF_SALT = sha256(new TextEncoder().encode('quickchat:nostr:v1'))
const STORAGE_KEY = 'quickchat:credential'
const ENCRYPTED_KEY_STORAGE = 'quickchat:encrypted_nsec'
const TRUSTED_NSEC_KEY = 'quickchat:trusted_nsec'
const TRUSTED_NSEC_EXPIRY_KEY = 'quickchat:trusted_nsec_expiry'
const TRUST_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week

interface StoredCredential {
  credentialId: string
  rawId: string // base64url
  displayName: string
  npub: string
}

export function getStoredCredential(): StoredCredential | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  return JSON.parse(raw) as StoredCredential
}

function storeCredential(cred: StoredCredential): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cred))
}

export function clearCredential(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(ENCRYPTED_KEY_STORAGE)
  localStorage.removeItem(TRUSTED_NSEC_KEY)
  localStorage.removeItem(TRUSTED_NSEC_EXPIRY_KEY)
}

export function storeTrustedNsec(privateKey: Uint8Array): void {
  localStorage.setItem(TRUSTED_NSEC_KEY, bytesToHex(privateKey))
  localStorage.setItem(TRUSTED_NSEC_EXPIRY_KEY, String(Date.now() + TRUST_TTL_MS))
}

export function getTrustedNsec(): Uint8Array | null {
  const hex = localStorage.getItem(TRUSTED_NSEC_KEY)
  const expiry = localStorage.getItem(TRUSTED_NSEC_EXPIRY_KEY)
  if (!hex || !expiry) return null
  if (Date.now() > Number(expiry)) {
    localStorage.removeItem(TRUSTED_NSEC_KEY)
    localStorage.removeItem(TRUSTED_NSEC_EXPIRY_KEY)
    return null
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - str.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Derive a CryptoKey from the credential for Firefox fallback encryption
async function deriveEncryptionKey(credentialId: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    credentialId.buffer.slice(credentialId.byteOffset, credentialId.byteOffset + credentialId.byteLength) as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: PRF_SALT.buffer.slice(PRF_SALT.byteOffset, PRF_SALT.byteOffset + PRF_SALT.byteLength) as ArrayBuffer,
      info: new TextEncoder().encode('quickchat:encrypt')
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptAndStoreKey(privkey: Uint8Array, credentialRawId: Uint8Array): Promise<void> {
  const key = await deriveEncryptionKey(credentialRawId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    privkey.buffer.slice(privkey.byteOffset, privkey.byteOffset + privkey.byteLength) as ArrayBuffer
  )
  const blob = {
    iv: toBase64Url(iv.buffer),
    data: toBase64Url(encrypted)
  }
  localStorage.setItem(ENCRYPTED_KEY_STORAGE, JSON.stringify(blob))
}

async function decryptStoredKey(credentialRawId: Uint8Array): Promise<Uint8Array | null> {
  const raw = localStorage.getItem(ENCRYPTED_KEY_STORAGE)
  if (!raw) return null
  const blob = JSON.parse(raw)
  const key = await deriveEncryptionKey(credentialRawId)
  const iv = fromBase64Url(blob.iv)
  const data = fromBase64Url(blob.data)
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer },
      key,
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    )
    return new Uint8Array(decrypted)
  } catch {
    return null
  }
}

export interface PasskeyResult {
  privateKey: Uint8Array
  publicKeyHex: string
  displayName: string
  prfSupported: boolean
}

export async function registerPasskey(displayName: string): Promise<PasskeyResult> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))

  const regOptions: PublicKeyCredentialCreationOptions = {
    challenge: challenge.buffer as ArrayBuffer,
    rp: { name: 'QuickChat', id: window.location.hostname },
    user: {
      id: userId.buffer as ArrayBuffer,
      name: displayName,
      displayName
    },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'required'
    },
    extensions: {
      // @ts-expect-error PRF extension not in TS types yet
      prf: { eval: { first: PRF_SALT } }
    }
  }

  const credential = await navigator.credentials.create({ publicKey: regOptions }) as PublicKeyCredential
  const rawIdBytes = new Uint8Array(credential.rawId)
  const credentialId = credential.id

  // Check PRF result
  const extResults = credential.getClientExtensionResults() as Record<string, any>
  const prfResults = extResults?.prf?.results
  let privateKey: Uint8Array
  let prfSupported = false

  if (prfResults?.first) {
    privateKey = new Uint8Array(prfResults.first).slice(0, 32)
    prfSupported = true
  } else {
    // Firefox fallback: generate random key and encrypt it
    privateKey = crypto.getRandomValues(new Uint8Array(32))
    await encryptAndStoreKey(privateKey, rawIdBytes)
  }

  const publicKeyHex = bytesToHex(schnorr.getPublicKey(privateKey))

  storeCredential({
    credentialId,
    rawId: toBase64Url(credential.rawId),
    displayName,
    npub: publicKeyHex
  })

  return { privateKey, publicKeyHex, displayName, prfSupported }
}

export async function authenticatePasskey(): Promise<PasskeyResult> {
  const stored = getStoredCredential()
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  // Use discoverable credentials (empty allowCredentials) so the OS passkey
  // picker shows ALL passkeys for this domain. This works across Safari vs
  // standalone PWA contexts which have separate localStorage.
  const authOptions: PublicKeyCredentialRequestOptions = {
    challenge: challenge.buffer as ArrayBuffer,
    rpId: window.location.hostname,
    allowCredentials: [],
    userVerification: 'required',
    extensions: {
      // @ts-expect-error PRF extension not in TS types
      prf: { eval: { first: PRF_SALT } }
    }
  }

  const credential = await navigator.credentials.get({ publicKey: authOptions }) as PublicKeyCredential

  const extResults = credential.getClientExtensionResults() as Record<string, any>
  const prfResults = extResults?.prf?.results
  let privateKey: Uint8Array
  let prfSupported = false

  if (prfResults?.first) {
    privateKey = new Uint8Array(prfResults.first).slice(0, 32)
    prfSupported = true
  } else {
    // Firefox fallback: decrypt stored key
    const decrypted = await decryptStoredKey(new Uint8Array(credential.rawId))
    if (!decrypted) throw new Error('Could not recover key — localStorage may have been cleared')
    privateKey = decrypted
  }

  const publicKeyHex = bytesToHex(schnorr.getPublicKey(privateKey))

  // Resolve display name: from stored credential, or from the passkey user handle
  const displayName = stored?.displayName || ''

  // Update stored credential to match the passkey that was actually used
  // (handles Safari vs PWA context mismatch)
  storeCredential({
    credentialId: credential.id,
    rawId: toBase64Url(credential.rawId),
    displayName,
    npub: publicKeyHex
  })

  return { privateKey, publicKeyHex, displayName, prfSupported }
}
