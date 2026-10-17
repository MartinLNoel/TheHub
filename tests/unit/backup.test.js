import { describe, expect, it } from 'vitest';
import { openStorage } from '../../src/core/db.js';
import { createRegistry } from '../../src/core/registry.js';
import { buildBackup, exportAll } from '../../src/core/transfer.js';
import {
  AMBER_AFTER,
  AUTO_AFTER,
  AUTO_MIN_GAP,
  RED_AFTER,
  STATUS_KEY,
  TOKEN_KEY,
  assertNoSecret,
  backupHealth,
  createBackupService,
  maskToken,
  shouldAutoBackup,
  verifyAgainstLive,
} from '../../src/core/backup.js';
import demo from '../fixtures/demo-module.js';
import { TEST_TOKEN, createFakeGitHub } from '../fixtures/fake-github.js';

let n = 0;
const freshName = () => `thehub-backup-${++n}-${Math.random().toString(36).slice(2)}`;
const HOUR = 3600_000;

async function setup({ notes = [{ text: 'a' }, { text: 'b' }], token = TEST_TOKEN, clock } = {}) {
  const registry = createRegistry([demo]);
  const storage = await openStorage({ dbName: freshName(), modules: registry.list() });
  await storage.load(demo);
  await storage.save(demo, { notes });
  const fake = createFakeGitHub();
  const time = clock || { t: Date.parse('2026-10-17T08:00:00Z') };
  const service = createBackupService({ storage, registry, appVersion: '0.3.0', fetch: fake.fetch, now: () => time.t });
  if (token) await service.setToken(token);
  return { registry, storage, fake, service, time };
}

describe('verifyAgainstLive', () => {
  const registry = createRegistry([demo]);
  const live = { demo: { schemaVersion: 2, data: { notes: [{ text: 'a' }] } } };

  it('accepts a backup that matches the live data', async () => {
    const file = await buildBackup({ modules: live, appVersion: 'x' });
    expect((await verifyAgainstLive(file, registry, live)).ok).toBe(true);
  });

  it('rejects a wrong checksum', async () => {
    const file = await buildBackup({ modules: live, appVersion: 'x' });
    file.sha256 = '0'.repeat(64);
    const r = await verifyAgainstLive(file, registry, live);
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/Checksum/);
  });

  it("rejects a module failing its validate", async () => {
    const bad = { demo: { schemaVersion: 2, data: { notes: [{ nope: 1 }] } } };
    const file = await buildBackup({ modules: bad, appVersion: 'x' });
    const r = await verifyAgainstLive(file, registry, bad);
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/every note needs text/);
  });

  it('rejects an item count that differs from the live data', async () => {
    const file = await buildBackup({ modules: { demo: { schemaVersion: 2, data: { notes: [] } } }, appVersion: 'x' });
    const r = await verifyAgainstLive(file, registry, live);
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/notes has 0 items in the backup but 1 live/);
  });

  it('rejects a backup that leaves out a live module', async () => {
    const other = { ...demo, id: 'other', name: 'Other' };
    const reg = createRegistry([demo, other]);
    const both = { ...live, other: { schemaVersion: 2, data: { notes: [] } } };
    const file = await buildBackup({ modules: live, appVersion: 'x' });
    expect((await verifyAgainstLive(file, reg, both)).problems.join()).toMatch(/Other: missing/);
  });
});

describe('backupNow', () => {
  it('uploads, reads back, verifies, and only then records lastVerifiedBackup', async () => {
    const { fake, service, storage } = await setup();
    const r = await service.backupNow();
    expect(r.ok).toBe(true);
    const status = await service.getStatus();
    expect(status.lastVerifiedBackup).toBe('2026-10-17T08:00:00.000Z');
    expect(status.lastCommit).toBe(fake.latest().sha);
    const stored = JSON.parse(fake.latest().text);
    expect(stored.modules.demo.data.notes).toHaveLength(2);
    // The read-back used the commit the upload made.
    expect(fake.requests.some((q) => q.method === 'GET' && q.url.includes(`ref=${r.commit}`))).toBe(true);
    storage.close();
  });

  it('does not record lastVerifiedBackup when the upload fails', async () => {
    const { fake, service, storage } = await setup();
    fake.knobs.putStatus = 500;
    const r = await service.backupNow();
    expect(r).toMatchObject({ ok: false, step: 'upload' });
    const status = await service.getStatus();
    expect(status.lastVerifiedBackup).toBeUndefined();
    expect(status.lastFailure.reason).toMatch(/Upload failed/);
    storage.close();
  });

  it('does not record lastVerifiedBackup when the read-back fails or differs', async () => {
    const { fake, service, storage } = await setup();
    fake.knobs.readBackStatus = 500;
    expect(await service.backupNow()).toMatchObject({ ok: false, step: 'readback' });
    fake.knobs.readBackStatus = null;
    fake.knobs.tamperReadBack = true;
    expect(await service.backupNow()).toMatchObject({ ok: false, step: 'readback' });
    expect((await service.getStatus()).lastVerifiedBackup).toBeUndefined();
    storage.close();
  });

  it('keeps the earlier lastVerifiedBackup when a later backup fails, and reports the failure', async () => {
    const { fake, service, storage, time } = await setup();
    await service.backupNow();
    time.t += 5 * HOUR;
    fake.knobs.offline = true;
    const r = await service.backupNow();
    expect(r.reason).toMatch(/could not be reached/);
    const status = await service.getStatus();
    expect(status.lastVerifiedBackup).toBe('2026-10-17T08:00:00.000Z');
    expect((await service.health()).state).toBe('red');
    storage.close();
  });

  it('retries once on a sha conflict', async () => {
    const { fake, service, storage } = await setup();
    await service.backupNow();
    fake.knobs.conflictsLeft = 1;
    expect((await service.backupNow()).ok).toBe(true);
    storage.close();
  });

  it('is not a failure when backups are not set up', async () => {
    const { service, storage } = await setup({ token: null });
    expect(await service.backupNow()).toMatchObject({ ok: false, step: 'setup' });
    expect((await service.getStatus()).lastFailure).toBeUndefined();
    storage.close();
  });
});

describe('the token', () => {
  it('never appears in a backup or an export', async () => {
    const { fake, service, storage, registry } = await setup();
    expect(await storage.getCore(TOKEN_KEY)).toBe(TEST_TOKEN);
    await service.backupNow();
    expect(fake.latest().text).not.toContain(TEST_TOKEN);
    expect(fake.latest().text).not.toContain('backupToken');
    const exported = JSON.stringify(await exportAll(storage, registry, '0.3.0'));
    expect(exported).not.toContain(TEST_TOKEN);
    storage.close();
  });

  it('is refused if it ever ends up inside the data', async () => {
    const { fake, service, storage } = await setup({ notes: [{ text: `oops ${TEST_TOKEN}` }] });
    const r = await service.backupNow();
    expect(r).toMatchObject({ ok: false, step: 'verify' });
    expect(fake.commits).toHaveLength(0);
    expect(() => assertNoSecret(`x${TEST_TOKEN}x`, TEST_TOKEN)).toThrow(/token/);
    storage.close();
  });

  it('is shown masked', () => {
    expect(maskToken(TEST_TOKEN)).toBe('••••••••OKEN');
    expect(maskToken(TEST_TOKEN)).not.toContain('SECRET');
  });
});

describe('automatic backups: the 24-hour and 10-minute rules', () => {
  it('shouldAutoBackup', () => {
    const now = Date.parse('2026-10-17T12:00:00Z');
    const iso = (ms) => new Date(now - ms).toISOString();
    expect(shouldAutoBackup({}, now).run).toBe(true);
    expect(shouldAutoBackup({ lastVerifiedBackup: iso(AUTO_AFTER - 1000) }, now)).toEqual({ run: false, why: 'recent' });
    expect(shouldAutoBackup({ lastVerifiedBackup: iso(AUTO_AFTER + 1000) }, now).run).toBe(true);
    expect(shouldAutoBackup({ lastAutoAttemptAt: iso(AUTO_MIN_GAP - 1000) }, now)).toEqual({ run: false, why: 'too-soon' });
    expect(shouldAutoBackup({ lastAutoAttemptAt: iso(AUTO_MIN_GAP + 1000) }, now).run).toBe(true);
  });

  it('maybeAutoBackup backs up once, then waits 24 hours; after a failure it waits 10 minutes', async () => {
    const { fake, service, storage, time } = await setup();
    expect((await service.maybeAutoBackup()).ok).toBe(true);
    expect(fake.commits).toHaveLength(1);
    time.t += 23 * HOUR;
    expect(await service.maybeAutoBackup()).toEqual({ skipped: 'recent' });
    time.t += 2 * HOUR;
    fake.knobs.offline = true;
    expect((await service.maybeAutoBackup()).ok).toBe(false);
    fake.knobs.offline = false;
    time.t += 5 * 60_000;
    expect(await service.maybeAutoBackup()).toEqual({ skipped: 'too-soon' });
    time.t += 6 * 60_000;
    expect((await service.maybeAutoBackup()).ok).toBe(true);
    expect(fake.commits).toHaveLength(2);
    storage.close();
  });

  it('does nothing when backups are not set up', async () => {
    const { service, storage } = await setup({ token: null });
    expect(await service.maybeAutoBackup()).toEqual({ skipped: 'not-set-up' });
    storage.close();
  });
});

describe('before a migration', () => {
  const demoV1 = { ...demo, schemaVersion: 1, migrations: {}, validate: () => [] };

  async function oldData(dbName) {
    const s = await openStorage({ dbName, modules: [demoV1] });
    await s.load(demoV1);
    await s.save(demoV1, { notes: ['old one', 'old two'] });
    s.close();
  }

  async function openWithBackup(dbName, configure) {
    const registry = createRegistry([demo]);
    const fake = createFakeGitHub();
    configure?.(fake);
    let service;
    const storage = await openStorage({ dbName, modules: registry.list(), beforeMigrate: (info) => service.beforeMigrate(info) });
    service = createBackupService({ storage, registry, appVersion: '0.3.0', fetch: fake.fetch });
    return { storage, service, fake };
  }

  it('backs up the old data first, then migrates', async () => {
    const dbName = freshName();
    await oldData(dbName);
    const { storage, service, fake } = await openWithBackup(dbName);
    await service.setToken(TEST_TOKEN);
    const r = await storage.load(demo);
    expect(r.status).toBe('migrated');
    const backedUp = JSON.parse(fake.latest().text);
    expect(backedUp.modules.demo).toEqual({ schemaVersion: 1, data: { notes: ['old one', 'old two'] } });
    expect(fake.latest().message).toMatch(/before migrating demo/);
    storage.close();
  });

  it('blocks the migration when the backup fails, and keeps the old data', async () => {
    const dbName = freshName();
    await oldData(dbName);
    const { storage, service } = await openWithBackup(dbName, (fake) => (fake.knobs.putStatus = 403));
    await service.setToken(TEST_TOKEN);
    await expect(storage.load(demo)).rejects.toThrow(/Nothing was converted/);
    const raw = await storage.readAll([demo]);
    expect(raw.demo).toEqual({ schemaVersion: 1, data: { notes: ['old one', 'old two'] } });
    storage.close();
  });

  it('blocks the migration when backups are not set up', async () => {
    const dbName = freshName();
    await oldData(dbName);
    const { storage } = await openWithBackup(dbName);
    await expect(storage.load(demo)).rejects.toThrow(/not set up/);
    expect((await storage.readAll([demo])).demo.schemaVersion).toBe(1);
    storage.close();
  });
});

describe('restore', () => {
  it('lists backups, verifies one, takes a safety backup first, then replaces', async () => {
    const { fake, service, storage } = await setup({ notes: [{ text: 'one' }] });
    await service.backupNow();
    await storage.save(demo, { notes: [{ text: 'one' }, { text: 'two' }, { text: 'three' }] });

    const list = await service.listBackups();
    expect(list).toHaveLength(1);
    const verified = await service.loadBackup(list[0].sha);
    expect(verified.ok).toBe(true);
    expect(verified.modules.demo.counts).toEqual({ notes: 1 });

    const result = await service.restore(verified);
    expect(result.safety.ok).toBe(true);
    // The safety backup holds the data from just before the restore.
    expect(fake.commits).toHaveLength(2);
    expect(JSON.parse(fake.latest().text).modules.demo.data.notes).toHaveLength(3);
    expect(fake.latest().message).toMatch(/before restore/);
    expect((await storage.readAll([demo])).demo.data.notes).toEqual([{ text: 'one' }]);
    storage.close();
  });

  it('replaces nothing when the safety backup fails', async () => {
    const { fake, service, storage } = await setup({ notes: [{ text: 'one' }] });
    await service.backupNow();
    await storage.save(demo, { notes: [] });
    const verified = await service.loadBackup(fake.latest().sha);
    fake.knobs.putStatus = 500;
    await expect(service.restore(verified)).rejects.toThrow(/Nothing was replaced/);
    expect((await storage.readAll([demo])).demo.data.notes).toEqual([]);
    storage.close();
  });

  it('runs migrations on an old backup, and refuses a damaged one', async () => {
    const { fake, service, storage } = await setup();
    const old = await buildBackup({ modules: { demo: { schemaVersion: 1, data: { notes: ['x'] } } }, appVersion: '0.2.0' });
    const c1 = fake.addCommit(JSON.stringify(old));
    const v = await service.loadBackup(c1.sha);
    expect(v.ok).toBe(true);
    expect(v.modules.demo).toMatchObject({ fromVersion: 1, schemaVersion: 2, data: { notes: [{ text: 'x' }] } });

    const damaged = { ...old, modules: { demo: { schemaVersion: 1, data: { notes: ['x', 'y'] } } } };
    const c2 = fake.addCommit(JSON.stringify(damaged));
    const d = await service.loadBackup(c2.sha);
    expect(d.ok).toBe(false);
    await expect(service.restore(d)).rejects.toThrow(/did not pass verification/);
    storage.close();
  });
});

describe('backupHealth (the Today card states)', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const ago = (ms) => new Date(now - ms).toISOString();
  const base = { config: { tokenExpires: '' }, hasToken: true, lastExportAt: ago(HOUR) };

  it('never, ok, amber, red', () => {
    expect(backupHealth({ ...base, status: {} }, now).state).toBe('never');
    expect(backupHealth({ ...base, status: { lastVerifiedBackup: ago(2 * HOUR) } }, now).state).toBe('ok');
    expect(backupHealth({ ...base, status: { lastVerifiedBackup: ago(AMBER_AFTER + 1) } }, now).state).toBe('amber');
    expect(backupHealth({ ...base, status: { lastVerifiedBackup: ago(RED_AFTER + 1) } }, now).state).toBe('red');
  });

  it('is red after a failure newer than the last good backup, with the reason', () => {
    const h = backupHealth({ ...base, status: { lastVerifiedBackup: ago(3 * HOUR), lastFailure: { at: ago(HOUR), reason: 'offline' } } }, now);
    expect(h.state).toBe('red');
    expect(h.failure.reason).toBe('offline');
    const older = backupHealth({ ...base, status: { lastVerifiedBackup: ago(HOUR), lastFailure: { at: ago(3 * HOUR), reason: 'x' } } }, now);
    expect(older.state).toBe('ok');
    expect(older.failure).toBeNull();
  });

  it('warns 14 days before the token expires, and after', () => {
    const at = (date) => backupHealth({ ...base, config: { tokenExpires: date }, status: {} }, now).tokenWarning;
    expect(at('2026-11-30')).toBeNull();
    expect(at('2026-10-30')).toMatch(/expires in 14 days/);
    expect(at('2026-10-01')).toMatch(/expired/);
  });

  it('reminds to export monthly', () => {
    expect(backupHealth({ ...base, status: {} }, now).exportDue).toBe(false);
    expect(backupHealth({ ...base, lastExportAt: ago(31 * 24 * HOUR), status: {} }, now).exportDue).toBe(true);
    expect(backupHealth({ ...base, lastExportAt: null, status: {} }, now).exportDue).toBe(true);
  });
});

describe('status storage', () => {
  it('keeps backup status in the core store, never in a module store', async () => {
    const { service, storage, registry } = await setup();
    await service.backupNow();
    expect(await storage.getCore(STATUS_KEY)).toMatchObject({ lastVerifiedBackup: expect.any(String) });
    const exported = await exportAll(storage, registry, '0.3.0');
    expect(Object.keys(exported.modules)).toEqual(['demo']);
    storage.close();
  });
});
