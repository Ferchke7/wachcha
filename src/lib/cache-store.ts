/**
 * Stale-While-Revalidate RAM + IndexedDB LRU cache.
 * Limits: 512 metadata entries / 16 MiB, 512 images / 128 MiB (ArrayBuffer + MIME for WebKit).
 */

const DB_NAME = 'wachcha-cache-v1';
const DATA_STORE = 'data';
const IMG_STORE = 'images';
const MAX_DATA_ENTRIES = 512;
const MAX_DATA_BYTES = 16 * 1024 * 1024;
const MAX_IMG_ENTRIES = 512;
const MAX_IMG_BYTES = 128 * 1024 * 1024;

interface DataRecord<T = unknown> {
  key: string;
  value: T;
  size: number;
  ts: number;
}

export interface ImageRecord {
  key: string;
  buffer: ArrayBuffer;
  mime: string;
  size: number;
  ts: number;
}

const ramData = new Map<string, DataRecord>();
const ramImages = new Map<string, ImageRecord>();
const inflight = new Map<string, Promise<unknown>>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DATA_STORE)) {
          db.createObjectStore(DATA_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(IMG_STORE)) {
          db.createObjectStore(IMG_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function initializeCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await Promise.all([
    new Promise<void>(resolve => {
      try {
        const tx = db.transaction(DATA_STORE, 'readonly');
        const req = tx.objectStore(DATA_STORE).getAll();
        req.onsuccess = () => {
          for (const rec of (req.result as DataRecord[]) || []) {
            ramData.set(rec.key, rec);
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    }),
    new Promise<void>(resolve => {
      try {
        const tx = db.transaction(IMG_STORE, 'readonly');
        const req = tx.objectStore(IMG_STORE).getAll();
        req.onsuccess = () => {
          for (const rec of (req.result as ImageRecord[]) || []) {
            ramImages.set(rec.key, rec);
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    }),
  ]);
}

function evictLru<T extends { key: string; size: number; ts: number }>(
  map: Map<string, T>,
  maxEntries: number,
  maxBytes: number
): string[] {
  let totalBytes = 0;
  for (const v of map.values()) totalBytes += v.size;
  if (map.size <= maxEntries && totalBytes <= maxBytes) return [];
  const sorted = [...map.values()].sort((a, b) => a.ts - b.ts);
  const evicted: string[] = [];
  for (const item of sorted) {
    if (map.size <= maxEntries && totalBytes <= maxBytes) break;
    map.delete(item.key);
    totalBytes -= item.size;
    evicted.push(item.key);
  }
  return evicted;
}

export function peekCache<T>(key: string): T | undefined {
  const rec = ramData.get(key);
  if (!rec) return undefined;
  rec.ts = Date.now();
  return rec.value as T;
}

export async function putCache<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  const size = serialized.length * 2;
  if (size > MAX_DATA_BYTES / 4) return;
  const rec: DataRecord<T> = { key, value, size, ts: Date.now() };
  ramData.set(key, rec);
  const removed = evictLru(ramData, MAX_DATA_ENTRIES, MAX_DATA_BYTES);

  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(DATA_STORE, 'readwrite');
    const store = tx.objectStore(DATA_STORE);
    store.put(rec);
    for (const old of removed) store.delete(old);
  } catch {
    // Non-fatal persistence error.
  }
}

export async function swrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const task = fetcher()
    .then(async result => {
      await putCache(key, result);
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, task);
  return task;
}

export function peekImageCache(url: string): ImageRecord | undefined {
  const rec = ramImages.get(url);
  if (!rec) return undefined;
  rec.ts = Date.now();
  return rec;
}

export async function putImageCache(url: string, buffer: ArrayBuffer, mime: string): Promise<void> {
  const rec: ImageRecord = { key: url, buffer, mime, size: buffer.byteLength, ts: Date.now() };
  ramImages.set(url, rec);
  const removed = evictLru(ramImages, MAX_IMG_ENTRIES, MAX_IMG_BYTES);
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    const store = tx.objectStore(IMG_STORE);
    store.put(rec);
    for (const old of removed) store.delete(old);
  } catch {
    // Non-fatal persistence error.
  }
}

export function cacheStats(): { entries: number; images: number } {
  return { entries: ramData.size, images: ramImages.size };
}

export async function clearAllCache(): Promise<void> {
  ramData.clear();
  ramImages.clear();
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction([DATA_STORE, IMG_STORE], 'readwrite');
    tx.objectStore(DATA_STORE).clear();
    tx.objectStore(IMG_STORE).clear();
  } catch {
    // Ignore clear error.
  }
}
