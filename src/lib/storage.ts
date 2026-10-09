/* Browser-side persistence: one IndexedDB record per region, holding the same
 * RegionFile object that goes into data/{region}.json.
 *
 * Every call is wrapped in a timeout. Where site data is blocked (private
 * windows, hardened settings, some headless browsers) indexedDB.open() can
 * simply never settle, and an unguarded await would leave the app stuck on
 * "loading" forever. */

import {
  REGIONS,
  emptyLibrary,
  normalise,
  type Library,
  type Region,
} from "./schema";

const DB_NAME = "medialog";
const STORE = "kv";
const TIMEOUT_MS = 3000;
const key = (region: Region) => `region:${region}`;

class StorageUnavailable extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new StorageUnavailable("IndexedDB 无响应")),
        ms,
      );
    }),
  ]);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= withTimeout(
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB blocked"));
    }),
    TIMEOUT_MS,
  ).catch((err) => {
    dbPromise = null; // let the next call try again
    throw err;
  });
  return dbPromise;
}

function request<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Loads every region. Throws if browser storage is unusable. */
export async function loadLibrary(): Promise<Library> {
  const lib = emptyLibrary();
  for (const region of REGIONS) {
    const raw = await withTimeout(
      request("readonly", (s) => s.get(key(region))),
      TIMEOUT_MS,
    );
    if (raw) lib[region] = normalise(raw, region);
  }
  return lib;
}

export function saveRegion(lib: Library, region: Region): Promise<void> {
  return withTimeout(
    request("readwrite", (s) => s.put(lib[region], key(region))).then(
      () => undefined,
    ),
    TIMEOUT_MS,
  );
}

/* --------------------------------------------- small values (sync state) */

export function kvGet<T>(name: string): Promise<T | undefined> {
  return withTimeout(
    request("readonly", (s) => s.get(name) as IDBRequest<T | undefined>),
    TIMEOUT_MS,
  );
}

export function kvSet(name: string, value: unknown): Promise<void> {
  return withTimeout(
    request("readwrite", (s) => s.put(value, name)).then(() => undefined),
    TIMEOUT_MS,
  );
}

export function kvDelete(name: string): Promise<void> {
  return withTimeout(
    request("readwrite", (s) => s.delete(name)).then(() => undefined),
    TIMEOUT_MS,
  );
}
