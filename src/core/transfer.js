// Export / import of everything as one JSON file, in the backup format of
// docs/plans/part-0-overview.md ("Backup file format"). The GitHub backups (backup.js) reuse
// buildBackup and verifyBackup from here.

import { localDate } from './dates.js';
import { runMigrations } from './db.js';

export const FORMAT = 'thehub-backup';
export const FORMAT_VERSION = 1;

/** JSON with object keys sorted at every level, so the same data always gives the same text. */
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') {
    const text = JSON.stringify(value);
    return text === undefined ? 'null' : text;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined && typeof value[k] !== 'function')
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds a backup/export object.
 * modules: { [id]: { schemaVersion, data } }
 */
export async function buildBackup({ modules, appVersion, createdAt = new Date().toISOString() }) {
  const clean = {};
  for (const id of Object.keys(modules).sort()) {
    clean[id] = { schemaVersion: modules[id].schemaVersion, data: modules[id].data };
  }
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    createdAt,
    appVersion,
    modules: clean,
    sha256: await sha256Hex(canonicalJSON(clean)),
  };
}

/** Counts per top-level field, for previews: { workouts: 34, settings: 3 }. */
export function countItems(data) {
  const counts = {};
  if (!data || typeof data !== 'object') return counts;
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) counts[key] = value.length;
    else if (value && typeof value === 'object') counts[key] = Object.keys(value).length;
  }
  return counts;
}

/**
 * Checks a parsed backup/export file against this app's registry, without writing anything.
 * Returns { ok, problems, modules, skipped, createdAt, appVersion } where `modules` holds each
 * known module's data migrated (on a copy) to the code's schema version:
 *   { [id]: { schemaVersion, data, fromVersion, counts } }
 * and `skipped` lists module ids in the file that this app does not know.
 */
export async function verifyBackup(file, registry) {
  const problems = [];
  const result = { ok: false, problems, modules: {}, skipped: [], createdAt: null, appVersion: null };

  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    problems.push('The file is not a TheHub export.');
    return result;
  }
  if (file.format !== FORMAT) problems.push('The file is not a TheHub export (wrong "format").');
  if (file.formatVersion !== FORMAT_VERSION) {
    problems.push(`Unsupported formatVersion ${file.formatVersion} (this app reads ${FORMAT_VERSION}).`);
  }
  if (!file.modules || typeof file.modules !== 'object' || Array.isArray(file.modules)) {
    problems.push('The file has no "modules" section.');
    return result;
  }
  if (typeof file.sha256 !== 'string') {
    problems.push('The file has no checksum.');
  } else if ((await sha256Hex(canonicalJSON(file.modules))) !== file.sha256) {
    problems.push('Checksum mismatch: the file was changed or damaged after it was made.');
  }
  result.createdAt = file.createdAt ?? null;
  result.appVersion = file.appVersion ?? null;
  if (problems.length) return result;

  for (const [id, entry] of Object.entries(file.modules)) {
    const mod = registry.get(id);
    if (!mod) {
      result.skipped.push(id);
      continue;
    }
    const v = entry?.schemaVersion;
    if (!Number.isInteger(v) || v < 1) {
      problems.push(`${mod.name}: missing or bad schema version.`);
      continue;
    }
    if (v > mod.schemaVersion) {
      problems.push(`${mod.name}: the data is from a newer app version (${v} > ${mod.schemaVersion}). Update the app first.`);
      continue;
    }
    let data;
    try {
      data = runMigrations(entry.data, v, mod.schemaVersion, mod.migrations);
    } catch (err) {
      problems.push(`${mod.name}: could not convert the data (${err.message}).`);
      continue;
    }
    const invalid = mod.validate(data) || [];
    if (invalid.length) {
      problems.push(...invalid.map((p) => `${mod.name}: ${p}`));
      continue;
    }
    result.modules[id] = { schemaVersion: mod.schemaVersion, data, fromVersion: v, counts: countItems(data) };
  }
  if (!problems.length && !Object.keys(result.modules).length) {
    problems.push('The file holds no data for any module of this app.');
  }
  result.ok = problems.length === 0;
  return result;
}

/** Builds the export object from everything in storage. */
export async function exportAll(storage, registry, appVersion) {
  const modules = await storage.readAll(registry.list());
  return buildBackup({ modules, appVersion });
}

/** Parses file text and verifies it. Never throws for a bad file; problems are in the result. */
export async function readImport(text, registry) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['The file is not valid JSON.'], modules: {}, skipped: [] };
  }
  return verifyBackup(parsed, registry);
}

/**
 * Writes a verified import into storage (replacing the modules it contains).
 * beforeReplace (optional) runs first and is awaited; if it throws, nothing is replaced. The
 * Settings screen passes "take a verified backup of the current state" when backups are set up.
 */
export async function applyImport(storage, verified, { beforeReplace } = {}) {
  if (!verified?.ok) throw new Error('Refusing to import a file that did not pass verification.');
  if (beforeReplace) await beforeReplace();
  const entries = {};
  for (const [id, m] of Object.entries(verified.modules)) {
    entries[id] = { schemaVersion: m.schemaVersion, data: m.data };
  }
  await storage.replaceAll(entries);
  return Object.keys(entries);
}

export function exportFileName(date = new Date()) {
  return `thehub-export-${localDate(date)}.json`;
}

/** Starts a download of the export object as a .json file. */
export function downloadJSON(obj, filename = exportFileName()) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
