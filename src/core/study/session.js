// The session builder and runner state, in the tutor prompt's format:
//   1. drill      due spaced-review items (3–5)
//   2. lesson     the next lesson (from `pointer`)
//   3. quiz       questions on that lesson's objectives
//      retrieval  1–2 delayed-retrieval questions from lessons studied at least two sessions back
//   4. debrief    score, mastery changes, next pointer (finishSession)
// The session lives in `progress.activeSession` and is saved after every step, so it can be stopped
// at any point and resumed. Answers are recorded (attempts + review queue) the moment they are given.
import { applyMastery, calibrate, dueReviews, masteryOf, nextSessionNo, questionStats, recordAttempt } from './progress.js';

// PLACEHOLDER(Q-14): default sizes and the re-teach rule (pointer stays below the pass mark).
export const SESSION_DEFAULTS = { drillSize: 4, quizSize: 5, retrievalCount: 2, passMark: 65 };

/** The lesson to study next: the pointer's lesson, else the first one. null when the course is done. */
export function nextLesson(course, progress) {
  if (!course.lessons.length) return null;
  if (progress.pointer === null || progress.pointer === undefined) return course.lessons[0];
  if (progress.pointer === '__done__') {
    // Lessons added after the course was finished (content ships chapter by chapter): carry on
    // after the last lesson studied, if there is one after it now.
    const studied = new Set(progress.sessions.filter((s) => s.kind === 'lesson').map((s) => s.section));
    let last = -1;
    course.lessons.forEach((l, i) => {
      if (studied.has(l.id)) last = i;
    });
    return last >= 0 ? course.lessons[last + 1] ?? null : null;
  }
  return course.lessons.find((l) => l.id === progress.pointer) || course.lessons[0];
}

/** The lesson after `lessonId`, as a pointer value ('__done__' after the last). */
export function pointerAfter(course, lessonId) {
  const i = course.lessons.findIndex((l) => l.id === lessonId);
  if (i < 0) return null;
  return course.lessons[i + 1]?.id ?? '__done__';
}

/**
 * How much a question should come up (higher first): past wrong answers and shaky objectives first,
 * unseen ones next, questions already answered correctly twice last. `calibration` of the last
 * session nudges by difficulty: "accelerate" prefers harder ones, "slow" easier ones.
 */
export function priority(question, { stats, progress, calibration }) {
  const st = stats[question.id];
  let p = 0;
  if (!st) p += 1;
  else {
    if (st.wrong > 0) p += 3;
    if (st.lastCorrect === false) p += 1;
    if (st.correct >= 2) p -= 5;
  }
  const m = masteryOf(progress, question.objective);
  if (m === 'shaky') p += 2;
  else if (m === 'untested') p += 1;
  else if (m === 'exam-ready') p -= 1;
  const d = question.difficulty ?? 2;
  if (calibration === 'accelerate') p += d - 2;
  else if (calibration === 'slow') p -= d - 2;
  return p;
}

/** Picks up to n questions by priority; ties are broken by rng so sessions vary. */
export function pickQuestions(candidates, n, ctx, rng = Math.random) {
  return candidates
    .map((q) => ({ q, p: priority(q, ctx) + rng() * 0.5 }))
    .sort((a, b) => b.p - a.p)
    .slice(0, Math.max(0, n))
    .map((x) => x.q);
}

/**
 * Objectives of lessons studied in lesson sessions numbered `sessionNo − 2` or earlier. A session may
 * also carry its own `objectives` (imported history whose lessons are not in the course, e.g. ISTQB
 * Chapters 1–2 studied before TheHub), so delayed retrieval reaches back into it too.
 */
export function delayedObjectives(course, progress, sessionNo) {
  const old = progress.sessions.filter((s) => s.kind === 'lesson' && s.no <= sessionNo - 2);
  const ids = new Set(old.map((s) => s.section));
  return new Set([
    ...course.lessons.filter((l) => ids.has(l.id)).flatMap((l) => l.objectives),
    ...old.flatMap((s) => (Array.isArray(s.objectives) ? s.objectives : [])),
  ]);
}

/** Builds a new session (the value for progress.activeSession). Pure apart from rng. */
export function buildSession(course, progress, options = {}) {
  const opts = { ...SESSION_DEFAULTS, ...options };
  const rng = opts.rng || Math.random;
  const no = opts.sessionNo ?? nextSessionNo(progress);
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  const stats = questionStats(progress.attempts);
  const lastLesson = [...progress.sessions].reverse().find((s) => s.calibration);
  const ctx = { stats, progress, calibration: lastLesson?.calibration };
  const used = new Set();
  const steps = [];

  // 1. Drill: due review items; an item naming only an objective gets one of its questions.
  for (const item of dueReviews(progress, no)) {
    if (steps.length >= opts.drillSize) break;
    let q = item.questionId ? byId.get(item.questionId) : null;
    if (!q && item.objective) {
      [q] = pickQuestions(course.questions.filter((x) => x.objective === item.objective && !used.has(x.id)), 1, ctx, rng);
    }
    if (!q || used.has(q.id)) continue;
    used.add(q.id);
    steps.push({ type: 'drill', questionId: q.id, reviewId: item.id });
  }

  // 2. Lesson.
  const lesson = nextLesson(course, progress);
  if (lesson) steps.push({ type: 'lesson', lessonId: lesson.id });

  // 3. Quiz on the lesson's objectives (or, with the course done, on the weakest objectives).
  const quizObjectives = lesson
    ? new Set(lesson.objectives)
    : new Set(course.questions.map((q) => q.objective).filter((o) => ['shaky', 'untested'].includes(masteryOf(progress, o))));
  const quiz = pickQuestions(course.questions.filter((q) => quizObjectives.has(q.objective) && !used.has(q.id)), opts.quizSize, ctx, rng);
  quiz.forEach((q) => used.add(q.id));
  steps.push(...quiz.map((q) => ({ type: 'quiz', questionId: q.id })));

  // Delayed retrieval from at least two sessions back.
  const delayed = delayedObjectives(course, progress, no);
  for (const o of quizObjectives) delayed.delete(o);
  const retrieval = pickQuestions(course.questions.filter((q) => delayed.has(q.objective) && !used.has(q.id)), opts.retrievalCount, ctx, rng);
  steps.push(...retrieval.map((q) => ({ type: 'retrieval', questionId: q.id })));

  return { no, kind: 'lesson', startedAt: new Date(opts.now ?? Date.now()).toISOString(), lessonId: lesson?.id ?? null, steps, index: 0, answers: {} };
}

/** The current step of the active session, or null at the debrief. */
export function currentStep(session) {
  return session && session.index < session.steps.length ? session.steps[session.index] : null;
}

/** Records the answer to the current question step. Pure: returns the new progress. */
export function answerStep(progress, course, chosen, at = new Date().toISOString()) {
  const s = progress.activeSession;
  const step = currentStep(s);
  if (!step || !step.questionId) throw new Error('The current step is not a question.');
  if (s.answers[s.index] !== undefined) return progress; // already answered: never twice
  const question = course.questions.find((q) => q.id === step.questionId);
  if (!question) throw new Error(`Question ${step.questionId} is no longer in the course.`);
  const { progress: next } = recordAttempt(progress, { question, chosen, sessionNo: s.no, kind: step.type, reviewId: step.reviewId, at });
  return { ...next, activeSession: { ...s, answers: { ...s.answers, [s.index]: chosen } } };
}

/** Moves to the next step, skipping steps whose content has gone. Pure. */
export function advance(progress, course) {
  const s = progress.activeSession;
  let index = s.index + 1;
  const exists = (st) =>
    st.lessonId ? course.lessons.some((l) => l.id === st.lessonId) : course.questions.some((q) => q.id === st.questionId);
  while (index < s.steps.length && !exists(s.steps[index])) index++;
  return { ...progress, activeSession: { ...s, index } };
}

/**
 * Ends the active session (at the debrief, or early: "save at whatever point was reached"):
 * scores the quiz and retrieval answers (binary), updates mastery, records the session, moves the
 * pointer when the lesson was reached and the quiz score is at least the pass mark (otherwise the
 * lesson is taught again: "< 65 %: slow down, re-teach"), and clears activeSession.
 * Returns { progress, debrief }.
 */
export function finishSession(progress, course, { now = new Date(), passMark = SESSION_DEFAULTS.passMark } = {}) {
  const s = progress.activeSession;
  if (!s) throw new Error('No session in progress.');
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  const rows = s.steps
    .map((step, i) => ({ step, i, chosen: s.answers[i] }))
    .filter((r) => r.step.questionId && r.chosen !== undefined)
    .map((r) => {
      const q = byId.get(r.step.questionId);
      return { type: r.step.type, label: r.step.label, question: q, chosen: r.chosen, correct: Boolean(q) && r.chosen === q.answer };
    });
  const scored = rows.filter((r) => r.type === 'quiz' || r.type === 'retrieval');
  const correct = scored.filter((r) => r.correct).length;
  const total = scored.length;
  const percent = total ? Math.round((correct / total) * 100) : null;
  const calibration = percent === null ? null : calibrate(percent);

  const { mastery, changes } = applyMastery(progress, s.no);
  const lessonIdx = s.steps.findIndex((st) => st.type === 'lesson');
  const reachedLesson = lessonIdx >= 0 && s.index > lessonIdx;
  const lessonAnswered = rows.some((r) => r.type === 'quiz');
  const quizAll = s.steps.filter((st) => st.type === 'quiz').length;
  const quizDone = Object.keys(s.answers).filter((i) => s.steps[i]?.type === 'quiz').length;
  let pointer = progress.pointer;
  let pointerReason = 'not reached';
  if (reachedLesson && s.lessonId) {
    if (quizAll > 0 && quizDone < quizAll) pointerReason = 'quiz not finished';
    else if (percent !== null && lessonAnswered && percent < passMark) pointerReason = 'below pass mark';
    else {
      pointer = pointerAfter(course, s.lessonId) ?? pointer;
      pointerReason = 'advanced';
    }
  }
  const lesson = course.lessons.find((l) => l.id === s.lessonId);
  const session = {
    no: s.no,
    date: new Date(now).toISOString().slice(0, 10),
    section: s.lessonId,
    score: percent,
    correct,
    total,
    kind: 'lesson',
    calibration,
    complete: s.index >= s.steps.length,
  };
  const debrief = {
    no: s.no,
    lessonTitle: lesson?.title ?? null,
    correct,
    total,
    percent,
    calibration,
    drill: rows.filter((r) => r.type === 'drill'),
    rows: scored,
    changes,
    pointer,
    pointerReason,
    nextLesson: nextLesson(course, { ...progress, pointer }),
    complete: session.complete,
  };
  return { progress: { ...progress, mastery, sessions: [...progress.sessions, session], pointer, activeSession: null }, debrief };
}
