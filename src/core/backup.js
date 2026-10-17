// Verified backups to the private GitHub repo, and restore from it.
// See SPEC.md ("Valid backups") and docs/plans/part-0-overview.md ("Backup file format").
//
// A backup counts as verified only when:
//   1. the built file passes verifyBackup (checksum, migrations on a copy, every module's validate)
//      and its item counts equal the live data's;
//   2. it was uploaded; and
//   3. the copy read back from GitHub (at the new commit) passes the same checks and carries the
//      same checksum.
// Only then is lastVerifiedBackup recorded in the core store.
//
// The token lives in the core store under its own key (TOKEN_KEY). Backups and exports are built
// from module stores only, so it can never be in them; assertNoSecret checks that anyway.
// PLACEHOLDER(Q-7): IndexedDB is per origin, and every GitHub Pages site of Martin's shares the
// origin martinlnoel.github.io, so his other Pages sites could read this store. Accepted for now
// (the token reaches one repo, Contents only); a custom domain would isolate it.

import { buildBackup, countItems, verifyBackup } from './transfer.js';
import { DEFAULT_OWNER, DEFAULT_REPO, GitHubError, checkRepoName, createGitHub } from './github.js';

export const TOKEN_KEY = 'backupToken';
export const CONFIG_KEY = 'backupConfig';
export const STATUS_KEY = 'backupStatus';
export const EXPORT_KEY = 'lastExportAt';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const AUTO_AFTER = 24 * HOUR; // back up automatically when the last verified backup is older
export const AUTO_MIN_GAP = 10 * 60 * 1000; // never more than once per 10 minutes automatically
export const AMBER_AFTER = 30 * HOUR;
export const RED_AFTER = 48 * HOUR;
export const TOKEN_WARN_BEFORE = 14 * DAY;
export const EXPORT_REMIND_AFTER = 30 * DAY; // the "monthly" export reminder. PLACEHOLDER(Q-9)

export class BackupError extends Error {
  constructor(message, step) {
    super(message);
    this.name = 'BackupError';
    this.step = step; // 'nothing' | 'setup' | 'verify' | 'upload' | 'readback'
  }
}

const time = (iso) => (iso ? Date.parse(iso) : NaN);

/** Throws when the token appears anywhere in `text` (defence in depth for backups and exports). */
export function assertNoSecret(text, token) {
  if (typeof token === 'string' && token.length >= 8 && String(text).includes(token)) {
    throw new BackupError('Refusing to save: the backup token was found inside the data.', 'verify');
  }
}

/** Shows only the last four characters of a token. */
export function maskToken(token) {
  if (!token) return '';
  return `••••••••${String(token).slice(-4)}`;
}

/**
 * Verifies a backup file against the live data it was made from.
 * live: { [id]: { schemaVersion, data } } as storage.readAll returns it.
 * Returns { ok, problems, verified }.
 */
export async function verifyAgainstLive(file, registry, live) {
  const verified = await verifyBackup(file, registry);
  const problems = [...verified.problems];
  if (verified.ok) {
    for (const [id, entry] of Object.entries(live)) {
      const name = registry.get(id)?.name ?? id;
      const inFile = file.modules?.[id];
      if (!inFile) {
        problems.push(`${name}: missing from the backup.`);
        continue;
      }
      if (inFile.schemaVersion !== entry.schemaVersion) {
        problems.push(`${name}: schema version ${inFile.schemaVersion} in the backup, ${entry.schemaVersion} live.`);
      }
      const want = countItems(entry.data);
      const got = countItems(inFile.data);
      for (const key of new Set([...Object.keys(want), ...Object.keys(got)])) {
        if (want[key] !== got[key]) {
          problems.push(`${name}: ${key} has ${got[key] ?? 0} items in the backup but ${want[key] ?? 0} live.`);
        }
      }
    }
  }
  return { ok: problems.length === 0, problems, verified };
}

/** The 24-hour and 10-minute rules: should an automatic backup run now? */
export function shouldAutoBackup(status, now = Date.now()) {
  const last = time(status?.lastVerifiedBackup);
  if (!Number.isNaN(last) && now - last < AUTO_AFTER) return { run: false, why: 'recent' };
  const attempt = time(status?.lastAutoAttemptAt);
  if (!Number.isNaN(attempt) && now - attempt < AUTO_MIN_GAP) return { run: false, why: 'too-soon' };
  return { run: true };
}

/** "3 hours ago" style text. */
export function relativeTime(iso, now = Date.now()) {
  const t = time(iso);
  if (Number.isNaN(t)) return 'never';
  const diff = Math.max(0, now - t);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(diff / HOUR);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(diff / DAY);
  return `${days} days ago`;
}

/**
 * What the Today card shows. Returns
 * { state: 'never' | 'ok' | 'amber' | 'red', configured, last, failure, tokenWarning, exportDue }.
 */
export function backupHealth({ status, config, hasToken, lastExportAt }, now = Date.now()) {
  const last = time(status?.lastVerifiedBackup);
  const failedAt = time(status?.lastFailure?.at);
  const failedSinceLast = !Number.isNaN(failedAt) && (Number.isNaN(last) || failedAt > last);
  let state;
  if (Number.isNaN(last)) state = failedSinceLast ? 'red' : 'never';
  else if (failedSinceLast || now - last >= RED_AFTER) state = 'red';
  else if (now - last >= AMBER_AFTER) state = 'amber';
  else state = 'ok';

  let tokenWarning = null;
  const expires = config?.tokenExpires ? Date.parse(`${config.tokenExpires}T23:59:59`) : NaN;
  if (hasToken && !Number.isNaN(expires)) {
    const left = expires - now;
    if (left < 0) tokenWarning = `The backup token expired on ${config.tokenExpires}. Make a new one and enter it in Settings → Backup.`;
    else if (left <= TOKEN_WARN_BEFORE) {
      const days = Math.ceil(left / DAY);
      tokenWarning = `The backup token expires in ${days} day${days === 1 ? '' : 's'} (${config.tokenExpires}). Make a new one soon.`;
    }
  }
  const exported = time(lastExportAt);
  const exportDue = Number.isNaN(exported) || now - exported >= EXPORT_REMIND_AFTER;

  return {
    state,
    configured: Boolean(hasToken),
    last: Number.isNaN(last) ? null : status.lastVerifiedBackup,
    failure: failedSinceLast ? status.lastFailure : null,
    tokenWarning,
    exportDue,
  };
}

/**
 * The backup service the app uses. Options: storage, registry, appVersion, fetch (tests pass a
 * mock), now() (tests pass a clock).
 */
export function createBackupService({ storage, registry, appVersion, fetch: fetchFn, now = () => Date.now() }) {
  let inFlight = null; // one backup at a time
  let preMigrationBackup = null; // one pre-migration backup per app start covers every module

  async function getConfig() {
    const saved = (await storage.getCore(CONFIG_KEY)) || {};
    return { owner: DEFAULT_OWNER, repo: DEFAULT_REPO, tokenExpires: '', ...saved };
  }

  async function saveConfig(changes) {
    const next = { ...(await getConfig()), ...changes };
    const problems = checkRepoName(next.owner, next.repo);
    if (next.tokenExpires && !/^\d{4}-\d{2}-\d{2}$/.test(next.tokenExpires)) problems.push('The expiry date must be a date.');
    if (problems.length) throw new BackupError(problems.join(' '), 'setup');
    await storage.setCore(CONFIG_KEY, { owner: next.owner, repo: next.repo, tokenExpires: next.tokenExpires || '' });
    return next;
  }

  const getToken = async () => (await storage.getCore(TOKEN_KEY)) || null;

  async function setToken(token) {
    const clean = String(token || '').trim();
    if (!clean) throw new BackupError('Paste the token first.', 'setup');
    if (/\s/.test(clean)) throw new BackupError('A token has no spaces in it; paste it again.', 'setup');
    await storage.setCore(TOKEN_KEY, clean);
  }

  const clearToken = () => storage.setCore(TOKEN_KEY, null);

  const getStatus = async () => (await storage.getCore(STATUS_KEY)) || {};

  async function updateStatus(changes) {
    const next = { ...(await getStatus()), ...changes };
    await storage.setCore(STATUS_KEY, next);
    return next;
  }

  async function client() {
    const token = await getToken();
    if (!token) throw new BackupError('Backups are not set up: enter a token in Settings → Backup.', 'setup');
    const { owner, repo } = await getConfig();
    return { github: createGitHub({ token, owner, repo, fetch: fetchFn }), token };
  }

  async function doBackup(reason) {
    const startedAt = new Date(now()).toISOString();
    try {
      const { github, token } = await client();
      const live = await storage.readAll(registry.list());
      if (!Object.keys(live).length) throw new BackupError('There is no module data to back up yet.', 'nothing');

      const file = await buildBackup({ modules: live, appVersion, createdAt: startedAt });
      const check = await verifyAgainstLive(file, registry, live);
      if (!check.ok) throw new BackupError(`The backup did not verify: ${check.problems.join(' ')}`, 'verify');

      const text = JSON.stringify(file, null, 2);
      assertNoSecret(text, token);

      let written;
      try {
        written = await github.writeBackup(text, `Backup ${startedAt} (${reason}, app ${appVersion})`);
      } catch (err) {
        throw new BackupError(`Upload failed: ${err.message}`, 'upload');
      }

      let downloaded;
      try {
        const got = await github.readBackup({ ref: written.commitSha });
        if (!got) throw new GitHubError('notfound', 'backup.json is missing after the upload.');
        downloaded = JSON.parse(got.text);
      } catch (err) {
        throw new BackupError(`Reading the backup back failed: ${err.message}`, 'readback');
      }
      if (downloaded?.sha256 !== file.sha256) {
        throw new BackupError('Reading the backup back failed: the copy on GitHub has a different checksum.', 'readback');
      }
      const recheck = await verifyAgainstLive(downloaded, registry, live);
      if (!recheck.ok) throw new BackupError(`The copy on GitHub did not verify: ${recheck.problems.join(' ')}`, 'readback');

      await updateStatus({ lastVerifiedBackup: startedAt, lastCommit: written.commitSha, lastFailure: null });
      return { ok: true, at: startedAt, commit: written.commitSha };
    } catch (err) {
      const message = err?.message || String(err);
      const step = err instanceof BackupError ? err.step : 'upload';
      // "Nothing to back up" and "not set up" are not failures of a backup.
      if (step !== 'nothing' && step !== 'setup') await updateStatus({ lastFailure: { at: startedAt, reason: message } });
      return { ok: false, step, reason: message };
    }
  }

  /** Runs a backup now (one at a time). Returns { ok, at, commit } or { ok: false, step, reason }. */
  function backupNow({ reason = 'manual' } = {}) {
    if (!inFlight) inFlight = doBackup(reason).finally(() => (inFlight = null));
    return inFlight;
  }

  /** On app start and on return to the foreground: back up if the 24-hour and 10-minute rules allow. */
  async function maybeAutoBackup() {
    if (!(await getToken())) return { skipped: 'not-set-up' };
    const rule = shouldAutoBackup(await getStatus(), now());
    if (!rule.run) return { skipped: rule.why };
    await updateStatus({ lastAutoAttemptAt: new Date(now()).toISOString() });
    return backupNow({ reason: 'automatic' });
  }

  /**
   * Connected to db.js hooks.beforeMigrate: a verified backup must succeed before any migration.
   * Throws (so nothing is migrated) when it fails or backups are not set up.
   * PLACEHOLDER(Q-8): with no token set up, migrations are blocked (not skipped with a warning).
   */
  async function beforeMigrate(info) {
    if (!preMigrationBackup) {
      preMigrationBackup = backupNow({ reason: `before migrating ${info?.moduleId ?? 'data'}` }).then((r) => {
        if (!r.ok) preMigrationBackup = null; // a later attempt (e.g. after going online) may try again
        return r;
      });
    }
    const result = await preMigrationBackup;
    if (!result.ok) {
      throw new BackupError(
        `This update converts your data, and a verified backup has to be made first, but it failed: ${result.reason} ` +
          'Nothing was converted. Fix the backup (Settings → Backup), then reopen the app.',
        result.step,
      );
    }
  }

  async function testConnection() {
    const { github } = await client();
    return github.testConnection();
  }

  async function listBackups() {
    const { github } = await client();
    return github.listBackups();
  }

  /** Downloads the backup at a commit and verifies it (checksum, migrations, validate). */
  async function loadBackup(commitSha) {
    const { github } = await client();
    const got = await github.readBackup({ ref: commitSha });
    if (!got) throw new BackupError('There is no backup in the repository yet.', 'readback');
    let file;
    try {
      file = JSON.parse(got.text);
    } catch {
      return { ok: false, problems: ['backup.json at that commit is not valid JSON.'], modules: {}, skipped: [] };
    }
    return verifyBackup(file, registry);
  }

  /**
   * Restores a verified backup (from loadBackup): takes a fresh backup of the current state first,
   * and only if that succeeds replaces the data. Migrations already ran in verifyBackup.
   */
  async function restore(verified) {
    if (!verified?.ok) throw new BackupError('Refusing to restore a backup that did not pass verification.', 'verify');
    const safety = await backupNow({ reason: 'before restore' });
    if (!safety.ok && safety.step !== 'nothing') {
      throw new BackupError(`Restore stopped: the safety backup of your current data failed (${safety.reason}). Nothing was replaced.`, safety.step);
    }
    const entries = {};
    for (const [id, m] of Object.entries(verified.modules)) entries[id] = { schemaVersion: m.schemaVersion, data: m.data };
    await storage.replaceAll(entries);
    return { restored: Object.keys(entries), safety };
  }

  async function health() {
    const [status, config, token, lastExportAt] = await Promise.all([
      getStatus(),
      getConfig(),
      getToken(),
      storage.getCore(EXPORT_KEY),
    ]);
    return backupHealth({ status, config, hasToken: Boolean(token), lastExportAt }, now());
  }

  return {
    getConfig,
    saveConfig,
    getToken,
    setToken,
    clearToken,
    getStatus,
    backupNow,
    maybeAutoBackup,
    beforeMigrate,
    testConnection,
    listBackups,
    loadBackup,
    restore,
    health,
    isConfigured: async () => Boolean(await getToken()),
    recordExport: () => storage.setCore(EXPORT_KEY, new Date(now()).toISOString()),
  };
}
