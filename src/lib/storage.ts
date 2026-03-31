/**
 * IndexedDB storage for messages and identity.
 * Uses raw IndexedDB API — no deps.
 */

const DB_NAME = 'quickchat'
const DB_VERSION = 1

export interface StoredMessage {
  id: string // event id
  contactPubkey: string
  content: string
  senderPubkey: string
  createdAt: number
  isMine: boolean
}

export interface StoredIdentity {
  displayName: string
  pubkeyHex: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' })
        store.createIndex('byContact', 'contactPubkey', { unique: false })
        store.createIndex('byTime', ['contactPubkey', 'createdAt'], { unique: false })
      }
      if (!db.objectStoreNames.contains('identity')) {
        db.createObjectStore('identity', { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveMessage(msg: StoredMessage): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite')
    tx.objectStore('messages').put(msg)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getMessages(contactPubkey: string): Promise<StoredMessage[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly')
    const index = tx.objectStore('messages').index('byContact')
    const req = index.getAll(contactPubkey)
    req.onsuccess = () => {
      const msgs = req.result as StoredMessage[]
      msgs.sort((a, b) => a.createdAt - b.createdAt)
      resolve(msgs)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getLastMessage(contactPubkey: string): Promise<StoredMessage | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly')
    const index = tx.objectStore('messages').index('byContact')
    const req = index.getAll(contactPubkey)
    req.onsuccess = () => {
      const msgs = req.result as StoredMessage[]
      if (msgs.length === 0) {
        resolve(null)
        return
      }
      msgs.sort((a, b) => b.createdAt - a.createdAt)
      resolve(msgs[0])
    }
    req.onerror = () => reject(req.error)
  })
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('identity', 'readwrite')
    tx.objectStore('identity').put({ key: 'current', ...identity })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getIdentity(): Promise<StoredIdentity | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('identity', 'readonly')
    const req = tx.objectStore('identity').get('current')
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function clearAllData(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['messages', 'identity'], 'readwrite')
    tx.objectStore('messages').clear()
    tx.objectStore('identity').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
