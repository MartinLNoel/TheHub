// One-time ISTQB progress import (docs/plans/part-6-istqb.md, Step 1).
//
// A Claude Code session reads Martin's Notion pages (read-only) and writes what it found as a
// "Notion-shaped" extract: private/istqb-notion-extract.json (format "istqb-notion-extract", see
// tests/fixtures/istqb-notion.synthetic.json for the shape). This script converts that extract into
// the study engine's progress shape and writes private/istqb-progress.json in the TheHub backup
// format, holding the `istqb` module only. Martin loads it on the phone: Settings → Import ISTQB progress.
//
//   node scripts/istqb-import.mjs [extract.json] [out.json]
//
// PLACEHOLDER(Q-15): the extract's per-LO ledger was mapped by hand from Notion's per-topic ledger.
// Both files are personal data: they live in the git-ignored private/ folder and are never committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MASTERY, calibrate, validateProgress } from '../src/core/study/progress.js';
import { buildBackup } from '../src/core/transfer.js';
import { progressSummary } from '../src/modules/istqb/import.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCORED = { lesson: ['quiz', 'retrieval'], 'mini-mock': ['mock'], 'full-mock': ['mock'] };
const KINDS = ['drill', 'quiz', 'retrieval', 'mock'];

const legacyText = (w) =>
  [`Question: ${w.question}`, `Your answer: ${w.given}`, `Correct: ${w.correct}`, w.why ? `Why it fooled you: ${w.why}` : null]
    .filter(Boolean)
    .join('\n');

/**
 * Converts a Notion extract into study progress. Pure.
 * objectives: the course's objective list ([{ code, chapter, kLevel }]), from content/istqb/objectives.json.
 * Returns { data, problems, warnings }: problems mean the extract cannot be imported as it is.
 */
export function convertNotionExtract(extract, objectives, { importedAt = new Date().toISOString() } = {}) {
  const problems = [];
  const warnings = [];
  if (!extract || extract.format !== 'istqb-notion-extract' || extract.formatVersion !== 1) {
    return { data: null, problems: ['not an istqb-notion-extract file (format version 1)'], warnings };
  }
  const codes = new Set(objectives.map((o) => o.code));
  const known = (code, where) => {
    if (codes.has(code)) return true;
    problems.push(`${where}: unknown objective ${code}`);
    return false;
  };

  // Mastery: every objective of the syllabus, from the ledger; missing ones are untested.
  const mastery = {};
  for (const o of objectives) mastery[o.code] = 'untested';
  for (const [code, level] of Object.entries(extract.ledger || {})) {
    if (!known(code, 'ledger')) continue;
    if (!MASTERY.includes(level)) problems.push(`ledger: ${code} is "${level}", not one of ${MASTERY.join(', ')}`);
    else mastery[code] = level;
  }
  const missing = objectives.filter((o) => !(o.code in (extract.ledger || {}))).map((o) => o.code);
  if (missing.length) warnings.push(`not in the Notion ledger, imported as untested: ${missing.join(', ')}`);

  // Sessions and attempts.
  const wrongLog = new Map((extract.wrongAnswerLog || []).map((w) => [`${w.session}/${w.ref}`, w]));
  const usedLog = new Set();
  const sessions = [];
  const attempts = [];
  const seenNos = new Set();
  for (const s of extract.sessions || []) {
    if (!Number.isInteger(s.no) || seenNos.has(s.no)) {
      problems.push(`session ${s.no}: missing or repeated number`);
      continue;
    }
    seenNos.add(s.no);
    if (!SCORED[s.kind]) {
      problems.push(`session ${s.no}: unknown kind "${s.kind}"`);
      continue;
    }
    const at = `${s.date}T12:00:00.000Z`;
    for (const r of s.results || []) {
      if (!KINDS.includes(r.kind)) problems.push(`session ${s.no} ${r.ref}: unknown result kind "${r.kind}"`);
      known(r.lo, `session ${s.no} ${r.ref}`);
      const key = `${s.no}/${r.ref}`;
      const w = wrongLog.get(key);
      if (w) usedLog.add(key);
      if (w && r.ok) warnings.push(`session ${s.no} ${r.ref}: in the wrong-answer log but marked correct`);
      const attempt = {
        questionId: `notion-s${s.no}-${r.ref}`,
        objective: r.lo,
        chosen: r.chosen ?? null,
        correct: Boolean(r.ok),
        at,
        sessionNo: s.no,
        kind: r.kind,
        imported: true,
      };
      if (r.answer) attempt.answer = r.answer;
      if (r.guess) attempt.guess = true;
      attempt.legacyText = w ? legacyText(w) : `${s.title || `Session ${s.no}`}, ${r.ref} (${r.lo}): ${r.ok ? 'correct' : 'wrong'}`;
      attempts.push(attempt);
    }
    const scored = (s.results || []).filter((r) => SCORED[s.kind].includes(r.kind));
    const correct = scored.filter((r) => r.ok).length;
    const total = scored.length;
    const computed = total ? Math.round((correct / total) * 100) : null;
    if (Number.isFinite(s.score) && computed !== null && computed !== s.score) {
      warnings.push(`session ${s.no}: Notion score ${s.score} % but the results give ${computed} % (Notion's kept)`);
    }
    const session = {
      no: s.no,
      date: s.date,
      section: s.kind === 'lesson' ? s.section : `mini-${s.chapter}`,
      score: Number.isFinite(s.score) ? s.score : computed,
      correct,
      total,
      kind: s.kind,
      imported: true,
      title: s.title,
    };
    if (s.kind === 'full-mock') session.section = 'full';
    if (s.kind === 'lesson') {
      session.objectives = (s.objectives || []).filter((o) => known(o, `session ${s.no} objectives`));
      session.calibration = calibrate(session.score);
      session.complete = true;
    }
    if (s.page) session.notionPage = s.page;
    sessions.push(session);
  }
  for (const key of wrongLog.keys()) if (!usedLog.has(key)) problems.push(`wrong-answer log ${key}: no matching result`);
  sessions.sort((a, b) => a.no - b.no);

  // Review queue.
  const reviewQueue = [];
  for (const r of extract.reviewQueue || []) {
    if (!r.id || !Number.isInteger(r.dueSession)) {
      problems.push(`review item ${r.id || '?'}: needs an id and a due session`);
      continue;
    }
    if (r.objective !== undefined) known(r.objective, `review item ${r.id}`);
    reviewQueue.push({
      id: r.id,
      objective: r.objective,
      note: r.note,
      addedSession: r.addedSession ?? 0,
      dueSession: r.dueSession,
      step: r.step ?? 0,
      correctCount: r.correctCount ?? 0,
    });
  }

  const p = extract.nextPointer;
  const pointer = p && typeof p.section === 'string' ? p.section : null;
  const lastNo = Math.max(0, ...sessions.map((s) => s.no));
  if (p?.session && p.session !== lastNo + 1) warnings.push(`next pointer says session ${p.session}, TheHub will number it ${lastNo + 1}`);

  const data = {
    mastery,
    reviewQueue,
    attempts,
    sessions,
    feedback: [],
    pointer,
    cardState: {},
    activeSession: null,
    activeMock: null,
    legacy: {
      importId: `notion-v2-s${extract.newestSession ?? lastNo}`,
      source: 'Notion: CTFL v4 Session States (v2) + Legacy Analysis',
      readAt: extract.readAt ?? null,
      importedAt,
      newestSession: extract.newestSession ?? lastNo,
      pages: extract.pages ?? {},
      nextPointer: p ?? null,
      cumulative: extract.cumulative ?? {},
      standingRules: extract.standingRules ?? [],
      ledgerNotes: extract.ledgerNotes ?? '',
    },
  };
  problems.push(...validateProgress(data));
  return { data, problems, warnings };
}

async function main() {
  const [extractPath = join(ROOT, 'private', 'istqb-notion-extract.json'), outPath = join(ROOT, 'private', 'istqb-progress.json')] = process.argv.slice(2);
  const extract = JSON.parse(readFileSync(extractPath, 'utf8'));
  const objectives = JSON.parse(readFileSync(join(ROOT, 'content', 'istqb', 'objectives.json'), 'utf8'));
  const { VERSION } = await import('../src/version.js');
  const { data, problems, warnings } = convertNotionExtract(extract, objectives);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (problems.length) {
    for (const p of problems) console.error(`problem: ${p}`);
    process.exitCode = 1;
    return;
  }
  const file = await buildBackup({ modules: { istqb: { schemaVersion: 1, data } }, appVersion: VERSION });
  writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  for (const line of progressSummary(data)) console.log(`  ${line}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
