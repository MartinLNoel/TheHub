import { describe, expect, it } from 'vitest';
import { openStorage } from '../../src/core/db.js';
import { createRegistry } from '../../src/core/registry.js';
import {
  applyImport,
  buildBackup,
  canonicalJSON,
  countItems,
  exportAll,
  exportFileName,
  readImport,
  sha256Hex,
  verifyBackup,
} from '../../src/core/transfer.js';
import demo from '../fixtures/demo-module.js';

let n = 0;
const freshName = () => `thehub-transfer-${++n}-${Math.random().toString(36).slice(2)}`;

async function setup(data) {
  const registry = createRegistry([demo]);
  const storage = await openStorage({ dbName: freshName(), modules: registry.list() });
  await storage.load(demo);
  if (data) await storage.save(demo, data);
  return { registry, storage };
}

describe('canonicalJSON and sha256Hex', () => {
  it('gives the same text whatever the key order', () => {
    expect(canonicalJSON({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(
      canonicalJSON({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1 }),
    );
  });

  it('hashes with SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('export and import', () => {
  it('exports in the Part 0 backup format', async () => {
    const { registry, storage } = await setup({ notes: [{ text: 'a' }] });
    const file = await exportAll(storage, registry, '9.9.9');
    expect(file).toMatchObject({
      format: 'thehub-backup',
      formatVersion: 1,
      appVersion: '9.9.9',
      modules: { demo: { schemaVersion: 2, data: { notes: [{ text: 'a' }] } } },
    });
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof file.createdAt).toBe('string');
    storage.close();
  });

  it('round-trips: export, then import into an empty app, gives identical data', async () => {
    const data = { notes: [{ text: 'Здравей' }, { text: 'emoji 🏋️' }, { text: 'third' }] };
    const a = await setup(data);
    const exported = await exportAll(a.storage, a.registry, '1.0.0');
    const text = JSON.stringify(exported, null, 2);

    const b = await setup();
    const verified = await readImport(text, b.registry);
    expect(verified.problems).toEqual([]);
    expect(verified.ok).toBe(true);
    await applyImport(b.storage, verified);

    const reExported = await exportAll(b.storage, b.registry, '1.0.0');
    expect(reExported.modules).toEqual(exported.modules);
    expect(reExported.sha256).toBe(exported.sha256);
    expect((await b.storage.load(demo)).data).toEqual(data);
    a.storage.close();
    b.storage.close();
  });

  it('rejects a tampered file (checksum mismatch) and writes nothing', async () => {
    const a = await setup({ notes: [{ text: 'real' }] });
    const exported = await exportAll(a.storage, a.registry, '1.0.0');
    exported.modules.demo.data.notes[0].text = 'tampered';

    const b = await setup({ notes: [{ text: 'mine' }] });
    const verified = await readImport(JSON.stringify(exported), b.registry);
    expect(verified.ok).toBe(false);
    expect(verified.problems.join(' ')).toMatch(/checksum/i);
    await expect(applyImport(b.storage, verified)).rejects.toThrow();
    expect((await b.storage.load(demo)).data.notes).toEqual([{ text: 'mine' }]);
    a.storage.close();
    b.storage.close();
  });

  it('rejects files that are not TheHub exports', async () => {
    const { registry, storage } = await setup();
    expect((await readImport('not json', registry)).ok).toBe(false);
    expect((await readImport('[1,2]', registry)).ok).toBe(false);
    expect((await readImport(JSON.stringify({ format: 'other', modules: {} }), registry)).ok).toBe(false);
    storage.close();
  });

  it('rejects data from a newer app version', async () => {
    const registry = createRegistry([demo]);
    const file = await buildBackup({ modules: { demo: { schemaVersion: 3, data: { notes: [] } } }, appVersion: 'x' });
    const v = await verifyBackup(file, registry);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/newer/);
  });

  it("rejects data that fails the module's validate", async () => {
    const registry = createRegistry([demo]);
    const file = await buildBackup({ modules: { demo: { schemaVersion: 2, data: { notes: 'oops' } } }, appVersion: 'x' });
    const v = await verifyBackup(file, registry);
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(['Demo: notes must be a list']);
  });

  it('migrates an older export on import', async () => {
    const registry = createRegistry([demo]);
    const file = await buildBackup({ modules: { demo: { schemaVersion: 1, data: { notes: ['old style'] } } }, appVersion: 'x' });
    const v = await verifyBackup(file, registry);
    expect(v.ok).toBe(true);
    expect(v.modules.demo).toMatchObject({ schemaVersion: 2, fromVersion: 1, data: { notes: [{ text: 'old style' }] } });
    expect(v.modules.demo.counts).toEqual({ notes: 1 });
  });

  it('skips modules this app does not know, and says so', async () => {
    const registry = createRegistry([demo]);
    const file = await buildBackup({
      modules: { demo: { schemaVersion: 2, data: { notes: [] } }, future: { schemaVersion: 1, data: {} } },
      appVersion: 'x',
    });
    const v = await verifyBackup(file, registry);
    expect(v.ok).toBe(true);
    expect(v.skipped).toEqual(['future']);
    expect(Object.keys(v.modules)).toEqual(['demo']);
  });
});

describe('helpers', () => {
  it('counts items per top-level field', () => {
    expect(countItems({ a: [1, 2], b: { x: 1 }, c: 3 })).toEqual({ a: 2, b: 1 });
    expect(countItems(null)).toEqual({});
  });

  it('names export files by date', () => {
    expect(exportFileName(new Date(2026, 9, 7))).toBe('thehub-export-2026-10-07.json');
  });
});

describe('import with a backup first', () => {
  it('runs beforeReplace first, and replaces nothing when it fails', async () => {
    const a = await setup({ notes: [{ text: 'from file' }] });
    const verified = await readImport(JSON.stringify(await exportAll(a.storage, a.registry, '1')), a.registry);
    const b = await setup({ notes: [{ text: 'current' }] });
    await expect(
      applyImport(b.storage, verified, { beforeReplace: async () => { throw new Error('backup failed'); } }),
    ).rejects.toThrow('backup failed');
    expect((await b.storage.readAll([demo])).demo.data.notes).toEqual([{ text: 'current' }]);

    const order = [];
    await applyImport(b.storage, verified, { beforeReplace: async () => order.push('backup') });
    order.push('replaced');
    expect(order).toEqual(['backup', 'replaced']);
    expect((await b.storage.readAll([demo])).demo.data.notes).toEqual([{ text: 'from file' }]);
    a.storage.close();
    b.storage.close();
  });
});
