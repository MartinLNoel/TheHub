// Settings → "Import ISTQB progress": reads a TheHub backup-format file that holds the `istqb` module
// (made once from Martin's Notion pages by scripts/istqb-import.mjs into private/istqb-progress.json)
// and prepares it for the core importer (src/core/module-import.js), which backs up first, validates
// and saves. prepare() never writes. Module contract: docs/plans/part-0-overview.md ("importers").
import { MASTERY, validateProgress } from '../../core/study/progress.js';
import { chaptersDone, readiness } from './rules.js';

export const ISTQB_SCHEMA_VERSION = 1;

/** Counts per mastery level over the whole mastery map. */
function masteryCounts(mastery) {
  const out = Object.fromEntries(MASTERY.map((m) => [m, 0]));
  for (const level of Object.values(mastery || {})) if (out[level] !== undefined) out[level]++;
  return out;
}

/** Summary lines for the import preview (and the script's console output). */
export function progressSummary(data) {
  const m = masteryCounts(data.mastery);
  const last = data.sessions.at(-1);
  const wrong = data.attempts.filter((a) => !a.correct).length;
  const r = readiness(data);
  return [
    `Sessions: ${data.sessions.length}${last ? ` (last: session ${last.no}, ${last.date})` : ''}`,
    `Scores: ${data.sessions.map((s) => (s.score ?? '–')).join(' · ') || 'none'}`,
    `Chapters done: ${chaptersDone(data).length}/6 · Readiness: ${r.level}`,
    `Objectives: ${Object.keys(data.mastery).length} — ${MASTERY.map((k) => `${m[k]} ${k}`).join(' · ')}`,
    `Review items: ${data.reviewQueue.length}`,
    `Answers: ${data.attempts.length} (${wrong} wrong, kept for the wrong-answer review)`,
    `Next lesson: ${data.pointer ?? 'the first lesson'}`,
  ];
}

/**
 * prepare(text, current) for the core importer. Accepts a TheHub export/backup file with an `istqb`
 * module. If TheHub already holds ISTQB study of its own, it refuses (an import would overwrite it);
 * importing the same file again changes nothing. Feedback and flashcard progress made in TheHub are kept.
 */
export function prepareIstqbImport(text, current) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['The file is not JSON. Pick private/istqb-progress.json (made by the import script).'] };
  }
  if (!file || file.format !== 'thehub-backup' || !file.modules) {
    return { ok: false, problems: ['The file is not a TheHub progress file (format "thehub-backup").'] };
  }
  const entry = file.modules.istqb;
  if (!entry || typeof entry !== 'object') return { ok: false, problems: ['The file holds no ISTQB progress.'] };
  if (entry.schemaVersion !== ISTQB_SCHEMA_VERSION) {
    return { ok: false, problems: [`The file's ISTQB data is version ${entry.schemaVersion}; this app reads version ${ISTQB_SCHEMA_VERSION}.`] };
  }
  const data = entry.data;
  const problems = validateProgress(data);
  if (problems.length) return { ok: false, problems };

  const importId = data.legacy?.importId ?? null;
  if (importId && current?.legacy?.importId === importId) {
    return { ok: true, nothingNew: true, data: current, summary: ['This progress is already imported: nothing new.'], problems: [] };
  }
  const own = (current?.sessions || []).filter((s) => !s.imported);
  if (own.length || current?.activeSession || current?.activeMock) {
    return {
      ok: false,
      problems: [
        `TheHub already has ISTQB study of its own (${own.length} session${own.length === 1 ? '' : 's'}${current?.activeSession || current?.activeMock ? ', one in progress' : ''}). Importing would overwrite it, so nothing was changed. Ask a Claude Code session to merge the two.`,
      ],
    };
  }
  const merged = {
    ...data,
    feedback: [...(current?.feedback || []), ...data.feedback.filter((f) => !(current?.feedback || []).some((c) => c.id === f.id))],
    cardState: { ...(data.cardState || {}), ...(current?.cardState || {}) },
    activeSession: null,
    activeMock: null,
  };
  return { ok: true, problems: [], data: merged, summary: progressSummary(merged) };
}
