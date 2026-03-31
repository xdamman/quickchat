/**
 * IndexedDB storage for messages and identity.
 * Uses raw IndexedDB API — no deps.
 */

const DB_NAME = 'quickchat'
const DB_VERSION = 2

export type DeliveryStatus = 'pending' | 'published' | 'confirmed'

export interface StoredMessage {
  id: string // event id
  contactPubkey: string
  content: string
  senderPubkey: string
  createdAt: number
  isMine: boolean
  deliveryStatus?: DeliveryStatus
}

export interface StoredIdentity {
  displayName: string
  pubkeyHex: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const oldVersion = event.oldVersion
      if (oldVersion < 1) {
        const store = db.createObjectStore('messages', { keyPath: 'id' })
        store.createIndex('byContact', 'contactPubkey', { unique: false })
        store.createIndex('byTime', ['contactPubkey', 'createdAt'], { unique: false })
        db.createObjectStore('identity', { keyPath: 'key' })
      }
      // v2: deliveryStatus field added to messages — no schema change needed,
      // it's just a new optional field on existing objects
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

export async function updateDeliveryStatus(id: string, status: DeliveryStatus): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite')
    const store = tx.objectStore('messages')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const msg = getReq.result as StoredMessage | undefined
      if (msg) {
        msg.deliveryStatus = status
        store.put(msg)
      }
      tx.oncomplete = () => resolve()
    }
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
