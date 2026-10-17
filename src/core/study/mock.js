// Timed mocks: N questions, a time limit, optional per-chapter counts, no feedback until the end,
// then a per-objective debrief. The timer is pure timestamps (startedAt / endsAt in epoch ms), never
// an interval count, so it is right after the screen locks, the app is closed, or the phone sleeps.
import { localDate } from '../dates.js';
import { applyMastery, nextSessionNo, questionStats, recordAttempt } from './progress.js';
import { chapterOf } from './content.js';

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Least-seen questions first (fresh ones before repeats), random within a tie. */
function freshest(list, stats, rng) {
  return shuffle(list, rng).sort((a, b) => (stats[a.id]?.seen ?? 0) - (stats[b.id]?.seen ?? 0));
}

/**
 * Picks the questions of a mock. `perChapter` is { [chapter]: count } (e.g. the official weighting);
 * without it, `count` questions come from the whole bank (or from `chapters` only). When a chapter has
 * too few questions the mock is filled from the others, and `shortfall` says so.
 * Returns { questionIds, shortfall: [{ chapter, wanted, got }] }.
 */
export function pickMockQuestions(course, progress, { count, perChapter, chapters, rng = Math.random }) {
  const stats = questionStats(progress.attempts);
  const withChapter = course.questions.map((q) => ({ q, ch: chapterOf(q, course.lessons) }));
  const picked = [];
  const shortfall = [];
  if (perChapter) {
    for (const [chapter, wanted] of Object.entries(perChapter)) {
      const pool = withChapter.filter((x) => String(x.ch) === String(chapter)).map((x) => x.q);
      const got = freshest(pool, stats, rng).slice(0, wanted);
      if (got.length < wanted) shortfall.push({ chapter: Number(chapter), wanted, got: got.length });
      picked.push(...got);
    }
  }
  const target = count ?? picked.length;
  if (picked.length < target) {
    const ids = new Set(picked.map((q) => q.id));
    const pool = withChapter
      .filter((x) => !ids.has(x.q.id) && (!chapters || chapters.map(String).includes(String(x.ch))))
      .map((x) => x.q);
    picked.push(...freshest(pool, stats, rng).slice(0, target - picked.length));
  }
  return { questionIds: shuffle(picked, rng).map((q) => q.id), shortfall };
}

/**
 * Starts a mock (the value for progress.activeMock).
 * config: { id, label, kind: "mini-mock" | "full-mock", count, minutes, perChapter?, chapters? }
 */
export function startMock(course, progress, config, { now = Date.now(), rng = Math.random } = {}) {
  const { questionIds, shortfall } = pickMockQuestions(course, progress, { ...config, rng });
  const startedAt = Number(now);
  return {
    no: nextSessionNo(progress),
    configId: config.id,
    label: config.label,
    kind: config.kind || 'mini-mock',
    questionIds,
    shortfall,
    answers: {},
    index: 0,
    startedAt,
    endsAt: startedAt + config.minutes * 60_000,
  };
}

/** Milliseconds left (never below 0), from timestamps only. */
export function remainingMs(mock, now = Date.now()) {
  return Math.max(0, mock.endsAt - Number(now));
}

export const isExpired = (mock, now = Date.now()) => remainingMs(mock, now) === 0;

/** "m:ss" (or "h:mm:ss") for a number of milliseconds. */
export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Saves an answer (changeable until the end; nothing is revealed). Refused once time is up. Pure. */
export function answerMock(progress, questionId, chosen, now = Date.now()) {
  const mock = progress.activeMock;
  if (!mock) throw new Error('No mock in progress.');
  if (isExpired(mock, now)) return progress;
  return { ...progress, activeMock: { ...mock, answers: { ...mock.answers, [questionId]: chosen } } };
}

export function moveMock(progress, index) {
  const mock = progress.activeMock;
  const i = Math.max(0, Math.min(mock.questionIds.length - 1, index));
  return { ...progress, activeMock: { ...mock, index: i } };
}

/**
 * Ends the mock (submitted, or time up): binary scoring, unanswered counts as wrong. Records one
 * attempt per answered question (kind "mock"), updates mastery and the review queue, records the
 * session. Returns { progress, debrief } with per-objective and per-chapter results.
 */
export function finishMock(progress, course, { now = Date.now() } = {}) {
  const mock = progress.activeMock;
  if (!mock) throw new Error('No mock in progress.');
  const at = new Date(Math.min(Number(now), mock.endsAt)).toISOString();
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  let next = progress;
  const rows = [];
  for (const id of mock.questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    const chosen = mock.answers[id] ?? null;
    // Unanswered (chosen null) is wrong (binary scoring) and goes to the review queue like any wrong answer.
    next = recordAttempt(next, { question: q, chosen, sessionNo: mock.no, kind: 'mock', at }).progress;
    rows.push({ question: q, chosen, correct: chosen === q.answer, chapter: chapterOf(q, course.lessons) });
  }
  const correct = rows.filter((r) => r.correct).length;
  const total = rows.length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const group = (key) => {
    const out = {};
    for (const r of rows) {
      const k = key(r);
      const g = (out[k] ||= { correct: 0, total: 0 });
      g.total++;
      if (r.correct) g.correct++;
    }
    return out;
  };
  const { mastery, changes } = applyMastery(next, mock.no);
  const elapsedMs = Math.min(Number(now), mock.endsAt) - mock.startedAt;
  const session = {
    no: mock.no,
    date: localDate(Number(now)), // the local calendar day (Q-18), not the UTC one
    section: mock.configId,
    score: percent,
    correct,
    total,
    kind: mock.kind,
    elapsedMs,
    timedOut: Number(now) >= mock.endsAt,
  };
  return {
    progress: { ...next, mastery, sessions: [...next.sessions, session], activeMock: null },
    debrief: {
      label: mock.label,
      correct,
      total,
      percent,
      rows,
      byObjective: group((r) => r.question.objective),
      byChapter: group((r) => r.chapter),
      changes,
      elapsedMs,
      timedOut: session.timedOut,
      shortfall: mock.shortfall,
    },
  };
}
