// db.js — tiny IndexedDB wrapper, no dependencies.
const DB_NAME = 'everyday-tracker';
const DB_VERSION = 1;
const STORES = ['rows', 'monthRecords', 'drafts', 'settings', 'weeklyHistory'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const result = fn(store);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

export const Store = {
  async getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, 'readonly');
      const req = t.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async get(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async put(storeName, obj) {
    return tx(storeName, 'readwrite', (store) => store.put(obj));
  },
  async delete(storeName, id) {
    return tx(storeName, 'readwrite', (store) => store.delete(id));
  },
  async clear(storeName) {
    return tx(storeName, 'readwrite', (store) => store.clear());
  },
};

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Full export / import for data portability (acts as the safety net for
// the free/self-hosted sync setup — always works even with no server).
export async function exportAllData() {
  const data = {};
  for (const s of STORES) data[s] = await Store.getAll(s);
  data._exportedAt = new Date().toISOString();
  data._version = DB_VERSION;
  return data;
}

export async function importAllData(data) {
  for (const s of STORES) {
    if (!Array.isArray(data[s])) continue;
    await Store.clear(s);
    for (const obj of data[s]) await Store.put(s, obj);
  }
}
