const DB_NAME = "cashflow-offline";
const DB_VERSION = 1;

export const IDB_STORES = {
  ENTITY_CACHE: "entity-cache",
  SYNC_QUEUE: "sync-queue",
} as const;

export type IdbStore = (typeof IDB_STORES)[keyof typeof IDB_STORES];

const STORES: IdbStore[] = [IDB_STORES.ENTITY_CACHE, IDB_STORES.SYNC_QUEUE];

let dbPromiseCache: Promise<IDBDatabase> | null = null;

function supported(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!supported()) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (dbPromiseCache) {
    return dbPromiseCache;
  }
  dbPromiseCache = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromiseCache;
}

function tx(
  db: IDBDatabase,
  store: IdbStore,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut(store: IdbStore, value: unknown): Promise<void> {
  const db = await openDb();
  await reqToPromise(tx(db, store, "readwrite").put(value));
}

export async function idbGet<T>(
  store: IdbStore,
  id: string,
): Promise<T | undefined> {
  const db = await openDb();
  const result = await reqToPromise(tx(db, store, "readonly").get(id));
  return result as T | undefined;
}

export async function idbGetAll<T>(store: IdbStore): Promise<T[]> {
  const db = await openDb();
  const result = await reqToPromise(tx(db, store, "readonly").getAll());
  return result as T[];
}

export async function idbGetByPrefix<T>(
  store: IdbStore,
  prefix: string,
): Promise<T[]> {
  const all = await idbGetAll<T>(store);
  return all.filter((item) =>
    String((item as unknown as { id: string }).id).startsWith(prefix),
  );
}

export async function idbDelete(store: IdbStore, id: string): Promise<void> {
  const db = await openDb();
  await reqToPromise(tx(db, store, "readwrite").delete(id));
}

export async function idbDeleteByPrefix(
  store: IdbStore,
  prefix: string,
): Promise<void> {
  const all = await idbGetAll<{ id: string }>(store);
  const db = await openDb();
  const os = tx(db, store, "readwrite");
  const storeAll = all.filter((item) => String(item.id).startsWith(prefix));
  await Promise.all(storeAll.map((item) => reqToPromise(os.delete(item.id))));
}

export async function idbClearStore(store: IdbStore): Promise<void> {
  const db = await openDb();
  await reqToPromise(tx(db, store, "readwrite").clear());
}