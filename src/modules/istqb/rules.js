// ISTQB course rules on top of the study engine (docs/plans/part-6-istqb.md), as pure functions:
// the official mock weighting, chapter completion (X/6), the readiness gate, the 10-day warm-up,
// and what the next session should be. The tutor prompt (v2) is the specification.
import { daysBetween, localDate } from '../../core/dates.js';
import { MASTERY, masteryOf, questionStats } from '../../core/study/progress.js';
import { nextLesson, pickQuestions } from '../../core/study/session.js';
import { chapterOf } from '../../core/study/content.js';

export const CHAPTERS = [1, 2, 3, 4, 5, 6];
/** The official CTFL v4.0 exam weighting: 40 questions. */
export const OFFICIAL_WEIGHTING = { 1: 8, 2: 6, 3: 4, 4: 11, 5: 9, 6: 2 };
export const FULL_MOCK_SIZE = 40;
export const FULL_MOCK_MINUTES = 60;
/** Exam pass mark, and the mini-mock bar that banks a chapter (7/10 rounds to 70 ≥ 65). */
export const PASS_MARK = 65;
/** Readiness gate: two consecutive complete full mocks at this score or better. */
export const READY_MARK = 80;
// PLACEHOLDER(Q-16): mini-mock size, split and time, the chapter bar, and the full-mock-only-counts-at-40 rule.
/** A gap of more than this many days opens the next session with a cumulative warm-up. */
export const WARMUP_AFTER_DAYS = 10;
export const WARMUP_SIZE = 5;
export const MINI_MOCK_SIZE = 10;
/** Of a mini-mock's 10 questions, this many come from its chapter; the rest are cumulative. */
export const MINI_MOCK_OWN = 7;

/** The mocks offered: the full mock and one mini-mock per chapter still to be taught (3–6). */
export function mockConfigs() {
  const minis = [3, 4, 5, 6].map((n) => ({
    id: `mini-${n}`,
    label: `Chapter ${n} mini-mock`,
    kind: 'mini-mock',
    count: MINI_MOCK_SIZE,
    minutes: 15,
    perChapter: { [n]: MINI_MOCK_OWN },
    chapters: CHAPTERS.filter((c) => c < n),
  }));
  return [
    { id: 'full', label: 'Full mock exam', kind: 'full-mock', minutes: FULL_MOCK_MINUTES, perChapter: { ...OFFICIAL_WEIGHTING } },
    ...minis,
  ];
}

/** Chapters banked: a mini-mock for the chapter (section "mini-N") scored at least the pass mark. */
export function chaptersDone(progress) {
  const done = new Set();
  for (const s of progress.sessions) {
    const m = /^mini-(\d)$/.exec(s.section || '');
    if (s.kind === 'mini-mock' && m && Number.isFinite(s.score) && s.score >= PASS_MARK) done.add(Number(m[1]));
  }
  return CHAPTERS.filter((c) => done.has(c));
}

/** Complete full mocks (all 40 questions), oldest first. A short mock (bank not full yet) never counts. */
export function fullMocks(progress) {
  return progress.sessions.filter((s) => s.kind === 'full-mock' && s.total >= FULL_MOCK_SIZE);
}

/**
 * The readiness gate. Ready = the last two complete full mocks both ≥ 80 %. Otherwise Approaching
 * (all six chapters banked, or the latest full mock passed), Building (any study recorded) or Not Ready.
 */
export function readiness(progress) {
  const mocks = fullMocks(progress);
  const last2 = mocks.slice(-2);
  const gateMet = last2.length === 2 && last2.every((s) => s.score >= READY_MARK);
  const chapters = chaptersDone(progress);
  let level = 'Not Ready';
  if (gateMet) level = 'Ready';
  else if (chapters.length === CHAPTERS.length || (mocks.length && mocks.at(-1).score >= PASS_MARK)) level = 'Approaching';
  else if (progress.sessions.length) level = 'Building';
  return { level, gateMet, recentFullMocks: mocks.slice(-3).map((s) => s.score), chaptersDone: chapters };
}

/** The date of the latest recorded session (any kind), or null. */
export function lastSessionDate(progress) {
  const dates = progress.sessions.map((s) => s.date).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d));
  return dates.length ? dates.sort().at(-1).slice(0, 10) : null;
}

/** Whole days between the last session and `now` (local dates), or null with no sessions. */
export function daysSinceLastSession(progress, now = new Date()) {
  const last = lastSessionDate(progress);
  if (!last) return null;
  return daysBetween(last, localDate(now));
}

/** The tutor prompt's rule: after a gap of more than 10 days, open with a 5-question cumulative warm-up. */
export function needsWarmup(progress, now = new Date()) {
  const days = daysSinceLastSession(progress, now);
  return days !== null && days > WARMUP_AFTER_DAYS;
}

/**
 * Objectives already studied: those of banked chapters, of lessons studied in a lesson session, and
 * those an imported session lists itself (Chapters 1–2 were taught before TheHub).
 */
export function studiedObjectives(course, progress) {
  const done = new Set(chaptersDone(progress));
  const lessonSessions = progress.sessions.filter((s) => s.kind === 'lesson');
  const ids = new Set(lessonSessions.map((s) => s.section));
  return new Set([
    ...course.questions.filter((q) => done.has(chapterOf(q, course.lessons))).map((q) => q.objective),
    ...course.lessons.filter((l) => ids.has(l.id)).flatMap((l) => l.objectives),
    ...lessonSessions.flatMap((s) => (Array.isArray(s.objectives) ? s.objectives : [])),
  ]);
}

/**
 * Replaces a new session's review drill with a cumulative warm-up: up to 5 questions on objectives
 * already studied, weakest and least-seen first, none repeated from the rest of the session. Due
 * review items stay in the queue for the next session. With nothing studied to warm up on, the
 * session is returned unchanged. Pure apart from rng.
 */
export function addWarmup(session, course, progress, { size = WARMUP_SIZE, rng = Math.random, days = null } = {}) {
  const rest = session.steps.filter((s) => s.type !== 'drill');
  const used = new Set(rest.map((s) => s.questionId).filter(Boolean));
  const studied = studiedObjectives(course, progress);
  const pool = course.questions.filter((q) => !used.has(q.id) && studied.has(q.objective));
  const ctx = { stats: questionStats(progress.attempts), progress, calibration: undefined };
  const picked = pickQuestions(pool, size, ctx, rng);
  if (!picked.length) return session;
  const warm = picked.map((q) => ({ type: 'drill', questionId: q.id, label: 'Warm-up', warmup: true }));
  return { ...session, warmup: { days, size: warm.length }, steps: [...warm, ...rest] };
}

/** The adjustSession hook: the warm-up when the gap rule applies, else the session as built. */
export function adjustSession(session, course, progress, now = new Date(), rng = Math.random) {
  if (!needsWarmup(progress, now)) return session;
  return addWarmup(session, course, progress, { rng, days: daysSinceLastSession(progress, now) });
}

/** Objectives per chapter, from objectives.json. */
export function objectivesByChapter(objectives) {
  const out = Object.fromEntries(CHAPTERS.map((c) => [c, []]));
  for (const o of objectives) (out[o.chapter] ||= []).push(o.code);
  return out;
}

/**
 * Chapters 3–6 whose teaching is finished: every objective of the chapter is in some lesson, and
 * every lesson of the chapter has been passed (the pointer is beyond it). Chapters 1–2 were taught
 * and banked before TheHub (imported), so they are never listed: TheHub has no mini-mock for them.
 */
export function chaptersTaught(course, progress, objectives) {
  const byCh = objectivesByChapter(objectives);
  const taughtLos = new Set(course.lessons.flatMap((l) => l.objectives));
  const next = nextLesson(course, progress);
  const nextIdx = next ? course.lessons.indexOf(next) : course.lessons.length;
  const out = [];
  for (const c of CHAPTERS.filter((x) => x > 2)) {
    const lessons = course.lessons.map((l, i) => ({ l, i })).filter((x) => x.l.chapter === c);
    if (!lessons.length || !byCh[c].length) continue;
    if (!byCh[c].every((o) => taughtLos.has(o))) continue;
    if (lessons.every((x) => x.i < nextIdx)) out.push(c);
  }
  return out;
}

/**
 * What the next study step should be:
 *   { kind: 'mini-mock', chapter }   a chapter is taught but not yet banked
 *   { kind: 'lesson', lesson }       the next lesson
 *   { kind: 'full-mock' }            all six chapters banked, gate not met
 *   { kind: 'ready' }                the readiness gate is met
 *   { kind: 'waiting' }              no lesson available yet (content still being written)
 */
export function nextStep(course, progress, objectives) {
  const done = chaptersDone(progress);
  const pending = chaptersTaught(course, progress, objectives).filter((c) => !done.includes(c));
  if (pending.length) return { kind: 'mini-mock', chapter: pending[0] };
  const lesson = nextLesson(course, progress);
  if (lesson) return { kind: 'lesson', lesson };
  if (done.length === CHAPTERS.length) return readiness(progress).gateMet ? { kind: 'ready' } : { kind: 'full-mock' };
  return { kind: 'waiting' };
}

/** Per-chapter mastery counts over all objectives: { [chapter]: { untested, shaky, solid, 'exam-ready' } }. */
export function masteryByChapter(progress, objectives) {
  const out = {};
  for (const c of CHAPTERS) out[c] = Object.fromEntries(MASTERY.map((m) => [m, 0]));
  for (const o of objectives) out[o.chapter][masteryOf(progress, o.code)]++;
  return out;
}

/** Wrong answers, newest first (imported ones carry legacyText instead of a question in the bank). */
export function wrongAnswers(progress) {
  return progress.attempts.map((a, i) => ({ ...a, index: i })).filter((a) => !a.correct).reverse();
}

/** Chapter counts of the question bank: { [chapter]: n }. */
export function questionsPerChapter(course) {
  const out = {};
  for (const q of course.questions) {
    const c = chapterOf(q, course.lessons);
    out[c] = (out[c] || 0) + 1;
  }
  return out;
}
