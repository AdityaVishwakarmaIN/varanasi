// Tiny key-value wrapper over IndexedDB (no library), plus an in-memory
// implementation with the same interface for unit tests.
//
// One database (`varanasi`) with one object store (`saves`). Values are
// strings (the same lz-string / JSON payloads that used to live in
// localStorage), so migrated data can be compared byte-for-byte.

export const IDB_CONFIG = {
  dbName: 'varanasi',
  storeName: 'saves',
  version: 1,
} as const;

export type KeyValueOp =
  | { type: 'set'; key: string; value: string }
  | { type: 'del'; key: string };

/**
 * Minimal async key-value store. `batch` must be atomic: either every op is
 * applied or none is (IndexedDB gives us this with a single readwrite
 * transaction).
 */
export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
  batch(ops: KeyValueOp[]): Promise<void>;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

/** Create an IndexedDB-backed store. The connection is opened lazily and reused. */
export function createIdbStore(
  dbName: string = IDB_CONFIG.dbName,
  storeName: string = IDB_CONFIG.storeName,
): KeyValueStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const openDb = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(dbName, IDB_CONFIG.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgraded the schema: close so it is not blocked, and
        // reopen on next use.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
    });
    // Allow a retry after a failed open.
    dbPromise.catch(() => {
      dbPromise = null;
    });
    return dbPromise;
  };

  const withStore = async <T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T | undefined> => {
    const db = await openDb();
    const tx = db.transaction(storeName, mode);
    const request = fn(tx.objectStore(storeName));
    const done = transactionDone(tx);
    const result = request ? await requestToPromise(request) : undefined;
    await done;
    return result;
  };

  return {
    async get(key) {
      const value = await withStore<unknown>('readonly', (store) => store.get(key));
      return typeof value === 'string' ? value : undefined;
    },
    async set(key, value) {
      await withStore('readwrite', (store) => {
        store.put(value, key);
      });
    },
    async del(key) {
      await withStore('readwrite', (store) => {
        store.delete(key);
      });
    },
    async keys() {
      const result = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
      return (result ?? []).filter((k): k is string => typeof k === 'string');
    },
    async batch(ops) {
      if (ops.length === 0) return;
      // One readwrite transaction = atomic: if the tab crashes or any op
      // fails, the transaction aborts and none of the ops are applied.
      await withStore('readwrite', (store) => {
        for (const op of ops) {
          if (op.type === 'set') store.put(op.value, op.key);
          else store.delete(op.key);
        }
      });
    },
  };
}

/** In-memory store with the same semantics (atomic batch). Used in tests. */
export function createMemoryStore(initial?: Record<string, string>): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
    },
    async del(key) {
      data.delete(key);
    },
    async keys() {
      return Array.from(data.keys());
    },
    async batch(ops) {
      // Apply to a copy first so a thrown error leaves `data` untouched.
      const next = new Map(data);
      for (const op of ops) {
        if (op.type === 'set') next.set(op.key, op.value);
        else next.delete(op.key);
      }
      data.clear();
      next.forEach((v, k) => data.set(k, v));
    },
  };
}

let defaultStore: KeyValueStore | null = null;

/** The shared `varanasi`/`saves` store used by the game. */
export function getSavesStore(): KeyValueStore {
  if (!defaultStore) defaultStore = createIdbStore();
  return defaultStore;
}

export const get = (key: string) => getSavesStore().get(key);
export const set = (key: string, value: string) => getSavesStore().set(key, value);
export const del = (key: string) => getSavesStore().del(key);
export const keys = () => getSavesStore().keys();
