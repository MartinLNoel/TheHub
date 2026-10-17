// Study progress: the data a study module stores (in IndexedDB and in backups), and the pure rules
// that change it. Shape (docs/plans/part-0-overview.md, "Study engine data"):
//
//   mastery        { [objective]: "untested" | "shaky" | "solid" | "exam-ready" }   (missing = untested)
//   reviewQueue    [{ id, questionId?, objective?, addedSession, dueSession, step, correctCount, note? }]
//   attempts       [{ questionId, objective, chosen, correct, at, sessionNo, kind }]   kind: drill|quiz|retrieval|mock
//   sessions       [{ no, date, section, score, correct, total, kind, calibration? }] kind: lesson|mini-mock|full-mock
//   feedback       [{ id, targetId, targetKind?, text, at, resolved }]          targetKind: lesson|question|card
//   pointer        id of the next lesson to study (null = the first lesson)
//   cardState      { [cardKey]: SM-2 state }       (scheduler.js; "<id>~rev" for the reverse side)
//   activeSession  the session in progress, or null (session.js)
//   activeMock     the mock in progress, or null (mock.js)
//   legacy         free-form, for imported history the engine does not read (Part 6)

export const MASTERY = ['untested', 'shaky', 'solid', 'exam-ready'];
/** The 1 / 3 / 7 session intervals of the tutor prompt's spaced review. */
export const REVIEW_INTERVALS = [1, 3, 7];
/** A review item leaves the queue after this many correct answers in a row. */
export const REVIEW_CORRECT_TO_CLEAR = 2;

export function defaultProgress() {
  return {
    mastery: {},
    reviewQueue: [],
    attempts: [],
    sessions: [],
    feedback: [],
    pointer: null,
    cardState: {},
    activeSession: null,
    activeMock: null,
  };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Problems with study progress; [] means complete (backup verify uses it). */
export function validateProgress(data) {
  if (!isObject(data)) return ['the study progress is missing'];
  const p = [];
  if (!isObject(data.mastery)) p.push('mastery must be an object');
  else {
    for (const [obj, level] of Object.entries(data.mastery)) {
      if (!MASTERY.includes(level)) p.push(`mastery of ${obj} is "${level}", not one of ${MASTERY.join(', ')}`);
    }
  }
  for (const key of ['reviewQueue', 'attempts', 'sessions', 'feedback']) {
    if (!Array.isArray(data[key])) p.push(`${key} must be a list`);
  }
  if (Array.isArray(data.reviewQueue)) {
    data.reviewQueue.forEach((r, i) => {
      if (!isObject(r) || typeof r.id !== 'string') return p.push(`review item ${i + 1} has no id`);
      if (!Number.isInteger(r.dueSession)) p.push(`review item ${r.id} has no due session`);
      if (r.questionId === undefined && r.objective === undefined && r.note === undefined) p.push(`review item ${r.id} has nothing to review`);
    });
  }
  if (Array.isArray(data.attempts)) {
    data.attempts.forEach((a, i) => {
      if (!isObject(a) || typeof a.correct !== 'boolean') p.push(`attempt ${i + 1} has no result`);
    });
  }
  if (Array.isArray(data.sessions)) {
    data.sessions.forEach((s, i) => {
      if (!isObject(s) || !Number.isInteger(s.no)) p.push(`session ${i + 1} has no number`);
    });
  }
  if (Array.isArray(data.feedback)) {
    data.feedback.forEach((f, i) => {
      if (!isObject(f) || typeof f.targetId !== 'string' || typeof f.text !== 'string') p.push(`feedback ${i + 1} is incomplete`);
    });
  }
  if (data.pointer !== null && typeof data.pointer !== 'string') p.push('pointer must be a lesson id or null');
  if (!isObject(data.cardState)) p.push('cardState must be an object');
  if (data.activeSession !== null && !isObject(data.activeSession)) p.push('activeSession must be an object or null');
  if (data.activeMock !== null && !isObject(data.activeMock)) p.push('activeMock must be an object or null');
  return p;
}

/** The next session number: one more than the highest recorded or in progress. */
export function nextSessionNo(progress) {
  const nos = [
    ...progress.sessions.map((s) => s.no),
    progress.activeSession?.no ?? 0,
    progress.activeMock?.no ?? 0,
  ];
  return Math.max(0, ...nos) + 1;
}

export const masteryOf = (progress, objective) => progress.mastery[objective] || 'untested';

// ---------- spaced review (1 / 3 / 7) ----------

/** Review items due in session `sessionNo`, oldest due first. */
export function dueReviews(progress, sessionNo) {
  return progress.reviewQueue
    .filter((r) => r.dueSession <= sessionNo)
    .sort((a, b) => a.dueSession - b.dueSession || a.addedSession - b.addedSession);
}

/**
 * Updates the review queue after one answer in session `sessionNo`. Pure; returns a new queue.
 *  - wrong: the question is (re)queued at step 0, due next session (+1), its correct count reset;
 *  - correct, and it is in the queue *and was due*: correct count + 1; at 2 it leaves the queue,
 *    else it moves to the next interval (+3, then +7, then +7 ...);
 *  - correct and not queued (or not yet due): nothing changes.
 */
export function updateReviewQueue(queue, { questionId, objective, correct, reviewId }, sessionNo) {
  // An imported item may name only an objective; the drill then passes its id as reviewId.
  const idx = reviewId ? queue.findIndex((r) => r.id === reviewId) : queue.findIndex((r) => r.questionId === questionId);
  const next = queue.slice();
  if (!correct) {
    const reset = { dueSession: sessionNo + REVIEW_INTERVALS[0], step: 0, correctCount: 0 };
    if (idx >= 0) next[idx] = { ...queue[idx], ...reset };
    else next.push({ id: `rq-${questionId}`, questionId, objective, addedSession: sessionNo, ...reset });
    return next;
  }
  if (idx < 0 || queue[idx].dueSession > sessionNo) return queue;
  const item = queue[idx];
  const correctCount = (item.correctCount || 0) + 1;
  if (correctCount >= REVIEW_CORRECT_TO_CLEAR) {
    next.splice(idx, 1);
    return next;
  }
  const step = Math.min((item.step || 0) + 1, REVIEW_INTERVALS.length - 1);
  next[idx] = { ...item, correctCount, step, dueSession: sessionNo + REVIEW_INTERVALS[step] };
  return next;
}

// ---------- attempts ----------

/** Records one answer: appends the attempt and updates the review queue. Pure. */
export function recordAttempt(progress, { question, chosen, sessionNo, kind, reviewId, at = new Date().toISOString() }) {
  const correct = chosen === question.answer;
  const attempt = { questionId: question.id, objective: question.objective, chosen, correct, at, sessionNo, kind };
  return {
    progress: {
      ...progress,
      attempts: [...progress.attempts, attempt],
      reviewQueue: updateReviewQueue(progress.reviewQueue, { questionId: question.id, objective: question.objective, correct, reviewId }, sessionNo),
    },
    attempt,
  };
}

/** Per question: { seen, correct, wrong, lastCorrect } from the attempts. */
export function questionStats(attempts) {
  const stats = {};
  for (const a of attempts) {
    const s = (stats[a.questionId] ||= { seen: 0, correct: 0, wrong: 0, lastCorrect: null });
    s.seen++;
    if (a.correct) s.correct++;
    else s.wrong++;
    s.lastCorrect = a.correct;
  }
  return stats;
}

// ---------- mastery ----------

/**
 * PLACEHOLDER(Q-14): the mastery rule below is the engine's own reading of the tutor prompt.
 * The new mastery level of one objective after a session, from its current level and this session's
 * results on it ({ correct, total }), and whether it was answered correctly in an EARLIER session too.
 *   all correct:      untested/shaky -> solid; solid -> exam-ready only with an earlier correct answer
 *                     (delayed retrieval proved it); exam-ready stays.
 *   half or more:     untested -> shaky; shaky stays; solid stays; exam-ready -> solid.
 *   less than half:   -> shaky.
 */
export function nextMastery(current = 'untested', { correct, total }, earlierCorrect = false) {
  if (!total) return current;
  const r = correct / total;
  if (r === 1) {
    if (current === 'solid') return earlierCorrect ? 'exam-ready' : 'solid';
    if (current === 'exam-ready') return 'exam-ready';
    return 'solid';
  }
  if (r >= 0.5) {
    if (current === 'untested') return 'shaky';
    if (current === 'exam-ready') return 'solid';
    return current;
  }
  return 'shaky';
}

/** Applies a session's attempts to the mastery map. Pure; returns { mastery, changes: [{ objective, from, to }] }. */
export function applyMastery(progress, sessionNo) {
  const inSession = progress.attempts.filter((a) => a.sessionNo === sessionNo && a.objective);
  const byObjective = {};
  for (const a of inSession) {
    const r = (byObjective[a.objective] ||= { correct: 0, total: 0 });
    r.total++;
    if (a.correct) r.correct++;
  }
  const mastery = { ...progress.mastery };
  const changes = [];
  for (const [objective, result] of Object.entries(byObjective)) {
    const earlier = progress.attempts.some((a) => a.objective === objective && a.correct && a.sessionNo < sessionNo);
    const from = mastery[objective] || 'untested';
    const to = nextMastery(from, result, earlier);
    if (to !== from) changes.push({ objective, from, to });
    mastery[objective] = to;
  }
  return { mastery, changes, byObjective };
}

/** Counts per mastery level for a list of objectives: { untested, shaky, solid, 'exam-ready' }. */
export function masterySummary(progress, objectives) {
  const out = Object.fromEntries(MASTERY.map((m) => [m, 0]));
  for (const o of new Set(objectives)) out[masteryOf(progress, o)]++;
  return out;
}

// ---------- difficulty calibration ----------

/** The tutor prompt's single scheme: < 65 % slow down, 65–85 % on pace, > 85 % accelerate. */
export function calibrate(percent) {
  if (percent < 65) return 'slow';
  if (percent > 85) return 'accelerate';
  return 'on-pace';
}

// ---------- feedback ----------

export function addFeedback(progress, { targetId, targetKind, text, at = new Date().toISOString(), id }) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('Feedback needs some text.');
  const note = { id: id || `fb-${Date.parse(at) || Date.now()}-${Math.random().toString(36).slice(2, 6)}`, targetId, text: clean, at, resolved: false };
  if (targetKind) note.targetKind = targetKind;
  return { ...progress, feedback: [...progress.feedback, note] };
}

export function setFeedbackResolved(progress, id, resolved) {
  return { ...progress, feedback: progress.feedback.map((f) => (f.id === id ? { ...f, resolved } : f)) };
}

/** Feedback counts as resolved when marked so, or when the content loop lists its id as handled. */
export function isResolved(note, handledIds = []) {
  return Boolean(note.resolved) || handledIds.includes(note.id);
}
