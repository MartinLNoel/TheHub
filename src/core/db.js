// Storage: one IndexedDB database "thehub". Store "core" holds settings and status as key/value
// records; each module has a store of its own holding one document under the key "doc":
//   { schemaVersion, data, updatedAt }
// See docs/plans/part-0-overview.md ("Storage").

export const DB_NAME = 'thehub';
export const CORE_STORE = 'core';
const DOC_KEY = 'doc';

/**
 * Hooks the core connects later. beforeMigrate runs (and is awaited) before any migration of a
 * module's stored data. If it throws, nothing is migrated.
 * PART 3 connects it to "take a verified backup first"; until then it does nothing.
 */
export const hooks = {
  beforeMigrate: async (_info) => {},
};

export class NewerDataError extends Error {
  constructor(moduleId, stored, code) {
    super(
      `${moduleId}: the stored data is from a newer version of TheHub (data version ${stored}, ` +
        `this app understands up to ${code}). Nothing will be saved until the app updates.`,
    );
    this.name = 'NewerDataError';
    this.moduleId = moduleId;
  }
}

/**
 * The save(newData) every module screen gets. The live state (entry.data) takes the new data at once, before
 * the write finishes, so a screen opened during the write starts from it; a failed write puts the old data
 * back (unless a later change came meanwhile). Bug found 2026-11-16: taking it only after the write let a
 * recipe saved right after logging food wipe that food.
 */
export function moduleSave({ storage, mod, entry }) {
  return async (data) => {
    const prev = entry.data;
    entry.data = data;
    try {
      await storage.save(mod, data);
    } catch (err) {
      if (entry.data === data) entry.data = prev;
      if (err instanceof NewerDataError) entry.readOnly = true;
      throw err;
    }
  };
}

export class MigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Runs migrations from version `from` up to `to`, in order, on a copy of `data`.
 * migrations[n] converts version n-1 to version n. Pure: the input is never changed.
 */
export function runMigrations(data, from, to, migrations = {}) {
  if (!Number.isInteger(from) || from < 1) throw new MigrationError(`bad stored schema version: ${from}`);
  if (from > to) throw new MigrationError(`cannot migrate down from ${from} to ${to}`);
  let current = structuredClone(data);
  for (let n = from + 1; n <= to; n++) {
    const step = migrations[n];
    if (typeof step !== 'function') throw new MigrationError(`no migration to version ${n}`);
    current = step(current);
    if (current === undefined) throw new MigrationError(`migration to version ${n} returned nothing`);
  }
  return current;
}

// --- small promise helpers around the IndexedDB callback API ---
function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

function openRaw(factory, name, version, storeNames) {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? factory.open(name) : factory.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const s of storeNames) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close(); // let another tab (a newer app version) upgrade
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('The database is open in another tab. Close it and retry.'));
  });
}

/**
 * Opens storage for the given modules, creating any missing stores.
 * Options: modules (from the registry), dbName, indexedDB (factory; tests pass their own),
 * beforeMigrate (defaults to hooks.beforeMigrate).
 */
export async function openStorage({
  modules = [],
  dbName = DB_NAME,
  indexedDB: factory = globalThis.indexedDB,
  beforeMigrate = (info) => hooks.beforeMigrate(info),
} = {}) {
  if (!factory) throw new Error('IndexedDB is not available in this browser.');
  const storeNames = [CORE_STORE, ...modules.map((m) => m.id)];

  let db = await openRaw(factory, dbName, undefined, storeNames);
  if (storeNames.some((s) => !db.objectStoreNames.contains(s))) {
    const next = db.version + 1;
    db.close();
    db = await openRaw(factory, dbName, next, storeNames);
  }

  const readOnly = new Set(); // module ids whose stored data is newer than the code

  async function getDoc(id) {
    const tx = db.transaction(id, 'readonly');
    const value = await req(tx.objectStore(id).get(DOC_KEY));
    return value ?? null;
  }

  async function putDoc(id, schemaVersion, data) {
    const tx = db.transaction(id, 'readwrite');
    tx.objectStore(id).put({ schemaVersion, data, updatedAt: new Date().toISOString() }, DOC_KEY);
    await done(tx);
  }

  const storage = {
    db,

    /**
     * Loads a module's data, migrating it if it is older than the code.
     * Returns { status: 'ok' | 'new' | 'migrated' | 'newer', data, storedVersion }.
     * 'newer' means read-only: save() refuses until the app is updated.
     */
    async load(mod) {
      const doc = await getDoc(mod.id);
      if (!doc) {
        const data = mod.defaultData();
        await putDoc(mod.id, mod.schemaVersion, data);
        return { status: 'new', data, storedVersion: mod.schemaVersion };
      }
      if (doc.schemaVersion > mod.schemaVersion) {
        readOnly.add(mod.id);
        return { status: 'newer', data: doc.data, storedVersion: doc.schemaVersion };
      }
      if (doc.schemaVersion < mod.schemaVersion) {
        await beforeMigrate({ moduleId: mod.id, from: doc.schemaVersion, to: mod.schemaVersion });
        const data = runMigrations(doc.data, doc.schemaVersion, mod.schemaVersion, mod.migrations);
        await putDoc(mod.id, mod.schemaVersion, data);
        return { status: 'migrated', data, storedVersion: doc.schemaVersion };
      }
      return { status: 'ok', data: doc.data, storedVersion: doc.schemaVersion };
    },

    /** Saves a module's data at the module's schema version. Refuses when stored data is newer. */
    async save(mod, data) {
      if (readOnly.has(mod.id)) {
        const doc = await getDoc(mod.id);
        throw new NewerDataError(mod.id, doc?.schemaVersion, mod.schemaVersion);
      }
      const doc = await getDoc(mod.id);
      if (doc && doc.schemaVersion > mod.schemaVersion) {
        readOnly.add(mod.id);
        throw new NewerDataError(mod.id, doc.schemaVersion, mod.schemaVersion);
      }
      await putDoc(mod.id, mod.schemaVersion, data);
    },

    isReadOnly: (id) => readOnly.has(id),

    /** The raw stored documents of the given modules: { [id]: { schemaVersion, data } }. */
    async readAll(mods) {
      const out = {};
      for (const m of mods) {
        const doc = await getDoc(m.id);
        if (doc) out[m.id] = { schemaVersion: doc.schemaVersion, data: doc.data };
      }
      return out;
    },

    /**
     * Replaces several modules' data in one transaction (all or nothing).
     * entries: { [id]: { schemaVersion, data } }, already migrated to the code's versions.
     */
    async replaceAll(entries) {
      const ids = Object.keys(entries);
      if (!ids.length) return;
      const tx = db.transaction(ids, 'readwrite');
      const now = new Date().toISOString();
      for (const id of ids) {
        const { schemaVersion, data } = entries[id];
        tx.objectStore(id).put({ schemaVersion, data, updatedAt: now }, DOC_KEY);
      }
      await done(tx);
      ids.forEach((id) => readOnly.delete(id));
    },

    async getCore(key) {
      const tx = db.transaction(CORE_STORE, 'readonly');
      return (await req(tx.objectStore(CORE_STORE).get(key))) ?? null;
    },

    async setCore(key, value) {
      const tx = db.transaction(CORE_STORE, 'readwrite');
      tx.objectStore(CORE_STORE).put(value, key);
      await done(tx);
    },

    close: () => db.close(),
  };
  return storage;
}

/**
 * On first run, asks the browser to keep this site's storage (so Android does not evict it).
 * Records the answer in the core store and does not ask again.
 */
export async function requestPersistence(storage, nav = globalThis.navigator) {
  const previous = await storage.getCore('persistence');
  if (previous) return previous;
  let granted = false;
  try {
    granted = Boolean(await nav?.storage?.persist?.());
  } catch {
    granted = false;
  }
  const record = { requestedAt: new Date().toISOString(), granted };
  await storage.setCore('persistence', record);
  return record;
}
