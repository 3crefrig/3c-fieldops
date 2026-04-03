const DB_NAME = 'fieldops-offline';
const DB_VERSION = 1;
const CACHE_STORE = 'dataCache';
const QUEUE_STORE = 'syncQueue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Cache data
export async function cacheData(key, data) {
  const db = await openDB();
  const tx = db.transaction(CACHE_STORE, 'readwrite');
  tx.objectStore(CACHE_STORE).put(data, key);
  return new Promise(r => { tx.oncomplete = r; });
}

// Read cached data
export async function getCachedData(key) {
  const db = await openDB();
  const tx = db.transaction(CACHE_STORE, 'readonly');
  const req = tx.objectStore(CACHE_STORE).get(key);
  return new Promise((resolve) => { req.onsuccess = () => resolve(req.result || null); req.onerror = () => resolve(null); });
}

// Queue an offline mutation
export async function queueMutation(mutation) {
  // mutation = { table, action: 'insert'|'update'|'delete', data, timestamp }
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).add({ ...mutation, timestamp: Date.now() });
  return new Promise(r => { tx.oncomplete = r; });
}

// Get all queued mutations
export async function getQueuedMutations() {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const req = tx.objectStore(QUEUE_STORE).getAll();
  return new Promise((resolve) => { req.onsuccess = () => resolve(req.result || []); req.onerror = () => resolve([]); });
}

// Clear a specific mutation from queue after successful sync
export async function clearMutation(id) {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).delete(id);
  return new Promise(r => { tx.oncomplete = r; });
}

// Clear all queued mutations
export async function clearAllMutations() {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).clear();
  return new Promise(r => { tx.oncomplete = r; });
}

// Get queue count
export async function getQueueCount() {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const req = tx.objectStore(QUEUE_STORE).count();
  return new Promise((resolve) => { req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(0); });
}
