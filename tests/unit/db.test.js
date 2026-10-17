import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  hooks,
  MigrationError,
  NewerDataError,
  openStorage,
  requestPersistence,
  runMigrations,
} from '../../src/core/db.js';

let n = 0;
const freshName = () => `thehub-test-${++n}-${Math.random().toString(36).slice(2)}`;

function makeModule(schemaVersion, migrations = {}, extra = {}) {
  return {
    id: 'mod',
    name: 'Mod',
    icon: 'M',
    schemaVersion,
    migrations,
    defaultData: () => ({ items: [], log: [] }),
    validate: () => [],
    routes: { '': () => {} },
    ...extra,
  };
}

/** Stores `data` at `version` by opening storage with a module of that version. */
async function seed(dbName, version, data) {
  const s = await openStorage({ dbName, modules: [makeModule(version)] });
  await s.save(makeModule(version), data);
  s.close();
}

afterEach(() => vi.restoreAllMocks());

describe('runMigrations', () => {
  it('runs each migration once, in order, from the stored version up to the code version', () => {
    const order = [];
    const migrations = {
      2: (d) => (order.push(2), { ...d, log: [...d.log, 'to2'] }),
      3: (d) => (order.push(3), { ...d, log: [...d.log, 'to3'] }),
      4: (d) => (order.push(4), { ...d, log: [...d.log, 'to4'] }),
    };
    const out = runMigrations({ log: [] }, 2, 4, migrations);
    expect(order).toEqual([3, 4]);
    expect(out.log).toEqual(['to3', 'to4']);
  });

  it('does not change its input', () => {
    const input = { log: ['a'] };
    runMigrations(input, 1, 2, { 2: (d) => { d.log.push('mutated'); return d; } });
    expect(input).toEqual({ log: ['a'] });
  });

  it('throws when a migration step is missing', () => {
    expect(() => runMigrations({}, 1, 3, { 2: (d) => d })).toThrow(MigrationError);
  });
});

describe('openStorage', () => {
  it('gives a new module its default data at the current schema version', async () => {
    const s = await openStorage({ dbName: freshName(), modules: [makeModule(1)] });
    const r = await s.load(makeModule(1));
    expect(r.status).toBe('new');
    expect(r.data).toEqual({ items: [], log: [] });
    s.close();
  });

  it('migrates stored data in order and saves it at the new version', async () => {
    const dbName = freshName();
    await seed(dbName, 1, { items: ['x'], log: [] });

    const v3 = makeModule(3, {
      2: (d) => ({ ...d, log: [...d.log, 'to2'] }),
      3: (d) => ({ ...d, log: [...d.log, 'to3'] }),
    });
    const s = await openStorage({ dbName, modules: [v3] });
    const r = await s.load(v3);
    expect(r.status).toBe('migrated');
    expect(r.storedVersion).toBe(1);
    expect(r.data).toEqual({ items: ['x'], log: ['to2', 'to3'] });

    // Saved at version 3: loading again does not migrate twice.
    const again = await s.load(v3);
    expect(again.status).toBe('ok');
    expect(again.data.log).toEqual(['to2', 'to3']);
    s.close();
  });

  it('runs beforeMigrate before any migration, with the versions involved', async () => {
    const dbName = freshName();
    await seed(dbName, 1, { items: [], log: [] });
    const events = [];
    const v2 = makeModule(2, { 2: (d) => (events.push('migrate 2'), d) });
    const s = await openStorage({
      dbName,
      modules: [v2],
      beforeMigrate: async (info) => events.push(`before ${info.moduleId} ${info.from}->${info.to}`),
    });
    await s.load(v2);
    expect(events).toEqual(['before mod 1->2', 'migrate 2']);
    s.close();
  });

  it('calls the default (observable no-op) hooks.beforeMigrate when no hook is passed', async () => {
    const dbName = freshName();
    await seed(dbName, 1, { items: [], log: [] });
    const spy = vi.spyOn(hooks, 'beforeMigrate');
    const v2 = makeModule(2, { 2: (d) => d });
    const s = await openStorage({ dbName, modules: [v2] });
    await s.load(v2);
    expect(spy).toHaveBeenCalledWith({ moduleId: 'mod', from: 1, to: 2 });
    s.close();
  });

  it('does not migrate (and keeps the old data) when beforeMigrate fails', async () => {
    const dbName = freshName();
    await seed(dbName, 1, { items: ['keep'], log: [] });
    const migrate = vi.fn((d) => d);
    const v2 = makeModule(2, { 2: migrate });
    const s = await openStorage({
      dbName,
      modules: [v2],
      beforeMigrate: async () => {
        throw new Error('backup failed');
      },
    });
    await expect(s.load(v2)).rejects.toThrow('backup failed');
    expect(migrate).not.toHaveBeenCalled();
    s.close();

    const v1 = makeModule(1);
    const check = await openStorage({ dbName, modules: [v1] });
    const r = await check.load(v1);
    expect(r).toMatchObject({ status: 'ok', data: { items: ['keep'] } });
    check.close();
  });

  it('refuses to write when the stored data is newer than the code', async () => {
    const dbName = freshName();
    await seed(dbName, 5, { items: ['from the future'], log: [] });

    const v2 = makeModule(2, { 2: (d) => d });
    const s = await openStorage({ dbName, modules: [v2] });
    const r = await s.load(v2);
    expect(r.status).toBe('newer');
    expect(s.isReadOnly('mod')).toBe(true);
    await expect(s.save(v2, { items: [], log: [] })).rejects.toBeInstanceOf(NewerDataError);
    s.close();

    const v5 = makeModule(5);
    const check = await openStorage({ dbName, modules: [v5] });
    expect((await check.load(v5)).data.items).toEqual(['from the future']);
    check.close();
  });

  it('adds the store of a newly added module to an existing database, keeping the others', async () => {
    const dbName = freshName();
    await seed(dbName, 1, { items: ['old'], log: [] });
    const other = { ...makeModule(1), id: 'other' };
    const s = await openStorage({ dbName, modules: [makeModule(1), other] });
    expect((await s.load(makeModule(1))).data.items).toEqual(['old']);
    expect((await s.load(other)).status).toBe('new');
    s.close();
  });

  it('keeps core settings', async () => {
    const dbName = freshName();
    const s = await openStorage({ dbName });
    await s.setCore('settings', { theme: 'dark' });
    expect(await s.getCore('settings')).toEqual({ theme: 'dark' });
    expect(await s.getCore('nothing')).toBeNull();
    s.close();
  });
});

describe('requestPersistence', () => {
  it('asks the browser once and remembers the answer', async () => {
    const s = await openStorage({ dbName: freshName() });
    const persist = vi.fn(async () => true);
    const nav = { storage: { persist } };
    expect((await requestPersistence(s, nav)).granted).toBe(true);
    await requestPersistence(s, nav);
    expect(persist).toHaveBeenCalledTimes(1);
    s.close();
  });

  it('copes with a browser without the storage API', async () => {
    const s = await openStorage({ dbName: freshName() });
    expect((await requestPersistence(s, {})).granted).toBe(false);
    s.close();
  });
});
