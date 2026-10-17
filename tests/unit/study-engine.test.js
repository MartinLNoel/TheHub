// The study engine's rules: SM-2 scheduler, 1/3/7 review queue, mastery, session builder, mocks.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, cardSides, dueSides, gradeSide, localDate, schedule } from '../../src/core/study/scheduler.js';
import {
  addFeedback, applyMastery, calibrate, defaultProgress, dueReviews, isResolved, nextMastery, recordAttempt,
  setFeedbackResolved, updateReviewQueue, validateProgress,
} from '../../src/core/study/progress.js';
import { advance, answerStep, buildSession, currentStep, finishSession, nextLesson } from '../../src/core/study/session.js';
import { answerMock, finishMock, formatClock, isExpired, pickMockQuestions, remainingMs, startMock } from '../../src/core/study/mock.js';
import { checkCourse } from '../../src/core/study/content.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'sample-course');
const read = (n) => JSON.parse(readFileSync(join(DIR, `${n}.json`), 'utf8'));
const course = checkCourse({ lessons: read('lessons'), questions: read('questions'), cards: read('cards') }).course;
const Q = (id) => course.questions.find((q) => q.id === id);
const wrongOf = (q) => ['A', 'B', 'C', 'D'].find((l) => l !== q.answer);
const fixedRng = () => 0;

describe('SM-2 scheduler', () => {
  const today = '2026-10-17';

  it('good: 1 day, then 6, then interval × ease', () => {
    let s = schedule(undefined, 'good', today);
    expect([s.interval, s.due, s.reps]).toEqual([1, '2026-10-18', 1]);
    s = schedule(s, 'good', '2026-10-18');
    expect([s.interval, s.due]).toEqual([6, '2026-10-24']);
    s = schedule(s, 'good', '2026-10-24');
    expect(s.interval).toBe(15); // 6 × 2.5
    expect(s.ef).toBe(2.5); // "good" (q=4) keeps the ease
  });

  it('easy raises the ease, hard lowers it, never below 1.3', () => {
    expect(schedule(undefined, 'easy', today).ef).toBe(2.6);
    expect(schedule(undefined, 'easy', today).interval).toBe(4);
    expect(schedule(undefined, 'hard', today).ef).toBe(2.36);
    let s;
    for (let i = 0; i < 20; i++) s = schedule(s, 'again', today);
    expect(s.ef).toBe(1.3);
  });

  it('again resets reps, is due today and counts a lapse', () => {
    const s = schedule(schedule(undefined, 'good', today), 'again', '2026-10-18');
    expect(s).toMatchObject({ reps: 0, interval: 0, due: '2026-10-18', lapses: 1 });
  });

  it('two-way cards are scheduled per direction', () => {
    const sides = cardSides(course.cards);
    expect(sides.map((s) => s.key)).toEqual(['c-hello', 'c-hello~rev', 'c-thanks', 'c-thanks~rev', 'c-sun']);
    let state = gradeSide({}, 'c-hello', 'good', today);
    expect(state['c-hello'].due).toBe('2026-10-18');
    expect(state['c-hello~rev']).toBeUndefined();
    state = gradeSide(state, 'c-hello~rev', 'again', today);
    const due = dueSides(course.cards, state, today).map((s) => s.key);
    expect(due[0]).toBe('c-hello~rev'); // due again today, first
    expect(due).not.toContain('c-hello'); // the other direction is due tomorrow
  });

  it('limits new sides per day, counting the ones introduced today', () => {
    expect(dueSides(course.cards, {}, today, { newPerDay: 2 })).toHaveLength(2);
    const state = gradeSide({}, 'c-hello', 'good', today);
    expect(dueSides(course.cards, state, today, { newPerDay: 2 }).map((s) => s.key)).toEqual(['c-hello~rev']);
  });

  it('local dates and day arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(localDate(new Date(2026, 9, 17, 0, 30))).toBe('2026-10-17');
  });
});

describe('spaced review queue (1 / 3 / 7)', () => {
  it('a wrong answer is due next session, then +3, then +7, and leaves after two correct', () => {
    let q = updateReviewQueue([], { questionId: 'x', objective: 'O', correct: false }, 5);
    expect(q).toEqual([{ id: 'rq-x', questionId: 'x', objective: 'O', addedSession: 5, dueSession: 6, step: 0, correctCount: 0 }]);
    q = updateReviewQueue(q, { questionId: 'x', correct: true }, 6);
    expect(q[0]).toMatchObject({ dueSession: 9, step: 1, correctCount: 1 });
    q = updateReviewQueue(q, { questionId: 'x', correct: true }, 9);
    expect(q).toEqual([]);
  });

  it('a miss on review starts again at 1; a third interval is 7', () => {
    let q = updateReviewQueue([], { questionId: 'x', correct: false }, 1);
    q = updateReviewQueue(q, { questionId: 'x', correct: true }, 2); // due 5
    q = updateReviewQueue(q, { questionId: 'x', correct: false }, 5);
    expect(q[0]).toMatchObject({ dueSession: 6, step: 0, correctCount: 0, addedSession: 1 });
    const item = { id: 'r', questionId: 'y', dueSession: 3, step: 1, correctCount: 0 };
    expect(updateReviewQueue([item], { questionId: 'y', correct: true }, 3)[0]).toMatchObject({ step: 2, dueSession: 10 });
  });

  it('a correct answer before the item is due changes nothing', () => {
    const q = updateReviewQueue([], { questionId: 'x', correct: false }, 1);
    expect(updateReviewQueue(q, { questionId: 'x', correct: true }, 1)).toBe(q);
  });

  it('objective-only items (imported) are updated by their review id', () => {
    const item = { id: 'legacy-1', objective: 'S-1.1', addedSession: 0, dueSession: 1, step: 0, correctCount: 0 };
    const q = updateReviewQueue([item], { questionId: 'q-1-1-a', objective: 'S-1.1', correct: true, reviewId: 'legacy-1' }, 1);
    expect(q[0]).toMatchObject({ id: 'legacy-1', correctCount: 1, dueSession: 4 });
    expect(q).toHaveLength(1);
  });

  it('dueReviews lists due items oldest first', () => {
    const p = { ...defaultProgress(), reviewQueue: [{ id: 'b', dueSession: 3, addedSession: 2 }, { id: 'a', dueSession: 2, addedSession: 1 }, { id: 'c', dueSession: 9, addedSession: 1 }] };
    expect(dueReviews(p, 3).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('mastery', () => {
  it.each([
    ['untested', 2, 2, false, 'solid'],
    ['shaky', 3, 3, false, 'solid'],
    ['solid', 2, 2, false, 'solid'],
    ['solid', 2, 2, true, 'exam-ready'],
    ['exam-ready', 1, 2, true, 'solid'],
    ['untested', 1, 2, false, 'shaky'],
    ['solid', 1, 2, false, 'solid'],
    ['solid', 0, 2, true, 'shaky'],
    ['exam-ready', 0, 1, true, 'shaky'],
  ])('%s with %i/%i (earlier correct: %s) -> %s', (from, correct, total, earlier, to) => {
    expect(nextMastery(from, { correct, total }, earlier)).toBe(to);
  });

  it('applyMastery uses only the session’s attempts and reports changes', () => {
    let p = defaultProgress();
    p = recordAttempt(p, { question: Q('q-1-1-a'), chosen: 'B', sessionNo: 1, kind: 'quiz' }).progress;
    p = { ...p, mastery: applyMastery(p, 1).mastery };
    expect(p.mastery['S-1.1']).toBe('solid');
    p = recordAttempt(p, { question: Q('q-1-1-b'), chosen: 'B', sessionNo: 3, kind: 'retrieval' }).progress;
    const r = applyMastery(p, 3);
    expect(r.mastery['S-1.1']).toBe('exam-ready');
    expect(r.changes).toEqual([{ objective: 'S-1.1', from: 'solid', to: 'exam-ready' }]);
  });

  it('calibration follows the tutor prompt', () => {
    expect([calibrate(64), calibrate(65), calibrate(85), calibrate(86)]).toEqual(['slow', 'on-pace', 'on-pace', 'accelerate']);
  });
});

describe('session builder', () => {
  it('a first session: the first lesson, a quiz on its objective, no drill, no retrieval', () => {
    const s = buildSession(course, defaultProgress(), { rng: fixedRng });
    expect(s.no).toBe(1);
    expect(s.steps[0]).toEqual({ type: 'lesson', lessonId: 's-1-1' });
    const quiz = s.steps.filter((x) => x.type === 'quiz');
    expect(quiz.length).toBe(3);
    expect(quiz.every((x) => Q(x.questionId).objective === 'S-1.1')).toBe(true);
    expect(s.steps.some((x) => x.type === 'drill' || x.type === 'retrieval')).toBe(false);
  });

  it('picks due review items for the drill and delayed retrieval from two or more sessions back', () => {
    const p = {
      ...defaultProgress(),
      pointer: 's-2-1',
      sessions: [
        { no: 1, section: 's-1-1', kind: 'lesson' },
        { no: 2, section: 's-1-2', kind: 'lesson' },
      ],
      reviewQueue: [
        { id: 'rq-q-1-2-a', questionId: 'q-1-2-a', objective: 'S-1.2', addedSession: 2, dueSession: 3, step: 0, correctCount: 0 },
        { id: 'rq-later', questionId: 'q-1-1-c', objective: 'S-1.1', addedSession: 2, dueSession: 5, step: 1, correctCount: 1 },
      ],
    };
    const s = buildSession(course, p, { rng: fixedRng });
    expect(s.no).toBe(3);
    expect(s.steps.filter((x) => x.type === 'drill')).toEqual([{ type: 'drill', questionId: 'q-1-2-a', reviewId: 'rq-q-1-2-a' }]);
    expect(s.steps.find((x) => x.type === 'lesson').lessonId).toBe('s-2-1');
    const retrieval = s.steps.filter((x) => x.type === 'retrieval').map((x) => Q(x.questionId).objective);
    // Session 3: only session 1's lesson (S-1.1) is two or more sessions back; session 2's is not.
    expect(retrieval.length).toBe(2);
    expect(retrieval.every((o) => o === 'S-1.1')).toBe(true);
  });

  it('prioritises past wrong answers and deprioritises questions answered correctly twice', () => {
    let p = defaultProgress();
    for (const sessionNo of [1, 2]) p = recordAttempt(p, { question: Q('q-1-1-a'), chosen: 'B', sessionNo, kind: 'quiz' }).progress;
    p = recordAttempt(p, { question: Q('q-1-1-c'), chosen: 'A', sessionNo: 2, kind: 'quiz' }).progress;
    p = { ...p, reviewQueue: [] };
    const s = buildSession(course, p, { rng: fixedRng, quizSize: 2 });
    const quiz = s.steps.filter((x) => x.type === 'quiz').map((x) => x.questionId);
    expect(quiz[0]).toBe('q-1-1-c');
    expect(quiz).not.toContain('q-1-1-a');
  });

  it('runs end to end: answers recorded at once, debrief updates mastery, sessions and pointer', () => {
    let p = { ...defaultProgress(), activeSession: buildSession(course, defaultProgress(), { rng: fixedRng }) };
    expect(currentStep(p.activeSession).type).toBe('lesson');
    p = advance(p, course);
    let first = true;
    while (currentStep(p.activeSession)) {
      const q = Q(currentStep(p.activeSession).questionId);
      p = answerStep(p, course, first ? wrongOf(q) : q.answer);
      if (first) {
        expect(p.attempts).toHaveLength(1);
        expect(p.reviewQueue).toHaveLength(1); // saved the moment it was answered
        expect(answerStep(p, course, q.answer)).toBe(p); // never answered twice
      }
      first = false;
      p = advance(p, course);
    }
    const { progress, debrief } = finishSession(p, course);
    expect(debrief).toMatchObject({ correct: 2, total: 3, percent: 67, calibration: 'on-pace', pointerReason: 'advanced' });
    expect(progress.pointer).toBe('s-1-2');
    expect(progress.mastery['S-1.1']).toBe('shaky');
    expect(progress.sessions).toEqual([expect.objectContaining({ no: 1, section: 's-1-1', kind: 'lesson', score: 67, complete: true })]);
    expect(progress.activeSession).toBe(null);
    expect(nextLesson(course, progress).id).toBe('s-1-2');
  });

  it('below the pass mark the lesson is taught again; stopping early keeps the pointer', () => {
    let p = { ...defaultProgress(), activeSession: buildSession(course, defaultProgress(), { rng: fixedRng }) };
    p = advance(p, course);
    while (currentStep(p.activeSession)) {
      p = advance(answerStep(p, course, wrongOf(Q(currentStep(p.activeSession).questionId))), course);
    }
    const low = finishSession(p, course);
    expect(low.debrief.pointerReason).toBe('below pass mark');
    expect(low.progress.pointer).toBe(null);

    let q = { ...defaultProgress(), activeSession: buildSession(course, defaultProgress(), { rng: fixedRng }) };
    q = advance(q, course);
    q = answerStep(q, course, 'A');
    const early = finishSession(q, course);
    expect(early.debrief.pointerReason).toBe('quiz not finished');
    expect(early.progress.pointer).toBe(null);
    expect(early.progress.sessions[0].complete).toBe(false);
    expect(early.progress.attempts).toHaveLength(1);
  });

  it('after the last lesson, sessions quiz the weakest objectives', () => {
    const p = { ...defaultProgress(), pointer: '__done__', mastery: { 'S-2.2': 'shaky', 'S-1.1': 'exam-ready', 'S-1.2': 'solid', 'S-2.1': 'solid', 'S-0.1': 'solid' } };
    const s = buildSession(course, p, { rng: fixedRng });
    expect(s.steps.some((x) => x.type === 'lesson')).toBe(false);
    expect(s.steps.filter((x) => x.type === 'quiz').every((x) => Q(x.questionId).objective === 'S-2.2')).toBe(true);
  });
});

describe('mock runner', () => {
  const config = { id: 'quick', label: 'Quick mock', kind: 'mini-mock', count: 5, minutes: 5 };

  it('the timer comes from timestamps: right after the screen was locked for minutes', () => {
    const t0 = Date.UTC(2026, 9, 17, 8, 0, 0);
    const mock = startMock(course, defaultProgress(), config, { now: t0, rng: fixedRng });
    expect(mock.endsAt - mock.startedAt).toBe(5 * 60_000);
    expect(remainingMs(mock, t0 + 1000)).toBe(299_000);
    // No ticks happened in between (the screen was off): still exact.
    expect(formatClock(remainingMs(mock, t0 + 3 * 60_000 + 30_500))).toBe('1:30');
    expect(isExpired(mock, t0 + 5 * 60_000)).toBe(true);
    expect(remainingMs(mock, t0 + 99 * 60_000)).toBe(0);
    expect(formatClock(60 * 60_000)).toBe('1:00:00');
  });

  it('per-chapter counts are respected, and shortfalls reported', () => {
    const { questionIds, shortfall } = pickMockQuestions(course, defaultProgress(), { perChapter: { 1: 3, 2: 2 }, rng: Math.random });
    const chapters = questionIds.map((id) => (id.startsWith('q-1-') ? 1 : 2));
    expect(chapters.filter((c) => c === 1)).toHaveLength(3);
    expect(chapters.filter((c) => c === 2)).toHaveLength(2);
    expect(shortfall).toEqual([]);
    const short = pickMockQuestions(course, defaultProgress(), { perChapter: { 0: 3 }, count: 3, rng: Math.random });
    expect(short.shortfall).toEqual([{ chapter: 0, wanted: 3, got: 1 }]);
    expect(short.questionIds).toHaveLength(3); // filled from other chapters
  });

  it('no answers after time is up; unanswered counts as wrong; per-objective debrief', () => {
    const t0 = 1_000_000;
    let p = { ...defaultProgress(), activeMock: startMock(course, defaultProgress(), config, { now: t0, rng: fixedRng }) };
    const ids = p.activeMock.questionIds;
    expect(ids).toHaveLength(5);
    p = answerMock(p, ids[0], Q(ids[0]).answer, t0 + 1000);
    p = answerMock(p, ids[1], wrongOf(Q(ids[1])), t0 + 2000);
    expect(answerMock(p, ids[2], 'A', t0 + 6 * 60_000)).toBe(p); // too late
    const { progress, debrief } = finishMock(p, course, { now: t0 + 6 * 60_000 });
    expect(debrief).toMatchObject({ correct: 1, total: 5, percent: 20, timedOut: true, elapsedMs: 5 * 60_000 });
    expect(Object.values(debrief.byObjective).reduce((a, r) => a + r.total, 0)).toBe(5);
    expect(progress.attempts).toHaveLength(5);
    expect(progress.attempts.every((a) => a.kind === 'mock')).toBe(true);
    expect(progress.reviewQueue).toHaveLength(4);
    expect(progress.sessions[0]).toMatchObject({ kind: 'mini-mock', score: 20, correct: 1, total: 5 });
    expect(progress.activeMock).toBe(null);
  });
});

describe('progress shape', () => {
  it('the default is valid; broken data is reported', () => {
    expect(validateProgress(defaultProgress())).toEqual([]);
    expect(validateProgress({ ...defaultProgress(), mastery: { X: 'great' } }).join()).toMatch(/great/);
    expect(validateProgress({ ...defaultProgress(), attempts: {} }).join()).toMatch(/attempts/);
    expect(validateProgress(null)).toHaveLength(1);
  });

  it('feedback is saved, resolved, and resolved by the content loop’s handled list', () => {
    let p = addFeedback(defaultProgress(), { targetId: 'q-1-1-a', targetKind: 'question', text: '  Option C is confusing ', at: '2026-10-17T10:00:00Z', id: 'fb-1' });
    expect(p.feedback).toEqual([{ id: 'fb-1', targetId: 'q-1-1-a', targetKind: 'question', text: 'Option C is confusing', at: '2026-10-17T10:00:00Z', resolved: false }]);
    expect(isResolved(p.feedback[0], ['fb-1'])).toBe(true);
    p = setFeedbackResolved(p, 'fb-1', true);
    expect(isResolved(p.feedback[0])).toBe(true);
    expect(() => addFeedback(p, { targetId: 'x', text: ' ' })).toThrow();
    expect(validateProgress(p)).toEqual([]);
  });
});

describe('Part 6 engine additions', () => {
  it('a finished course carries on when lessons are added after its last studied lesson', () => {
    const first = { ...course, lessons: course.lessons.slice(0, 1) };
    const p = { ...defaultProgress(), pointer: '__done__', sessions: [{ no: 1, kind: 'lesson', section: first.lessons[0].id, date: '2026-10-01' }] };
    expect(nextLesson(first, p)).toBe(null);
    expect(nextLesson(course, p).id).toBe(course.lessons[1].id);
    // Done and the last lesson studied: still done.
    const last = course.lessons.at(-1).id;
    expect(nextLesson(course, { ...p, sessions: [{ no: 1, kind: 'lesson', section: last }] })).toBe(null);
    // Done with no lesson sessions at all (e.g. imported): stays done.
    expect(nextLesson(course, { ...defaultProgress(), pointer: '__done__' })).toBe(null);
  });

  it('delayed retrieval also reaches objectives that imported sessions list themselves', () => {
    const p = {
      ...defaultProgress(),
      sessions: [{ no: 1, kind: 'lesson', section: 'not-in-course', objectives: [course.questions[0].objective], date: '2026-07-01' }],
      pointer: course.lessons.at(-1).id,
    };
    const s = buildSession(course, p, { sessionNo: 3, rng: fixedRng, retrievalCount: 2 });
    const retrieval = s.steps.filter((x) => x.type === 'retrieval').map((x) => Q(x.questionId).objective);
    expect(retrieval.length).toBeGreaterThan(0);
    expect(new Set(retrieval)).toEqual(new Set([course.questions[0].objective]));
  });

  it('a step label (e.g. Warm-up) is carried into the debrief rows', () => {
    const q = course.questions[0];
    let p = { ...defaultProgress(), activeSession: { no: 1, kind: 'lesson', lessonId: null, steps: [{ type: 'drill', questionId: q.id, label: 'Warm-up' }], index: 0, answers: {} } };
    p = answerStep(p, course, q.answer);
    p = advance(p, course);
    const { debrief } = finishSession(p, course);
    expect(debrief.drill.map((r) => r.label)).toEqual(['Warm-up']);
  });
});
