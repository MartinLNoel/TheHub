// ISTQB-only screens on top of the engine's: the course summary card on the home screen (chapters
// X/6, readiness gate, next step, warm-up, mastery per chapter) and the wrong-answer review
// (#/istqb/review). The rest (session, lessons, mocks, cards, feedback) are the engine's screens.
import { h, mount } from '../../core/dom.js';
import { questionView, toast } from '../../core/study/screens.js';
import { MASTERY, nextSessionNo, questionStats } from '../../core/study/progress.js';
import { pickQuestions } from '../../core/study/session.js';
import {
  CHAPTERS, READY_MARK, chaptersDone, daysSinceLastSession, masteryByChapter, needsWarmup, nextStep, readiness, wrongAnswers,
} from './rules.js';

const BASE = 'content/istqb/';
const MASTERY_ICON = { untested: '○', shaky: '◐', solid: '●', 'exam-ready': '★' };

// ---------- extra content: objectives.json, handled-feedback.json ----------

let cache = { objectives: [], handled: [] };
let loading = null;

/** The extras loaded so far (empty lists until getExtras() has finished). */
export const extras = () => cache;

/** Loads objectives.json and handled-feedback.json once (network first, then the offline cache). Never throws. */
export function getExtras(fetchFn = globalThis.fetch) {
  if (!loading) {
    loading = (async () => {
      const base = new URL(BASE, globalThis.document?.baseURI ?? globalThis.location?.href).href;
      const get = async (name) => {
        try {
          const res = await fetchFn(new URL(name, base).href);
          if (!res.ok) return [];
          const list = await res.json();
          return Array.isArray(list) ? list : [];
        } catch {
          return [];
        }
      };
      const [objectives, handled] = await Promise.all([get('objectives.json'), get('handled-feedback.json')]);
      cache = { objectives, handled: handled.filter((x) => typeof x === 'string') };
      return cache;
    })();
  }
  return loading;
}

/** Tests only: set the extras directly. */
export function setExtras(value) {
  cache = { objectives: value.objectives || [], handled: value.handled || [] };
  loading = Promise.resolve(cache);
}

// ---------- home: the course card ----------

function nextStepView(step, data, env) {
  const no = data.activeSession?.no ?? nextSessionNo(data);
  switch (step.kind) {
    case 'lesson':
      return [h('p', { 'data-testid': 'istqb-next' }, `Next: session ${no}, Chapter ${step.lesson.chapter} §${step.lesson.section} ${step.lesson.title}`)];
    case 'mini-mock':
      return [
        h('p', { 'data-testid': 'istqb-next' }, `Next: the Chapter ${step.chapter} mini-mock (10 questions; 7/10 banks the chapter).`),
        h('a', { class: 'btn btn--primary', href: `#/${env}/mock` }, 'Go to mocks'),
      ];
    case 'full-mock':
      return [
        h('p', { 'data-testid': 'istqb-next' }, 'Next: a full mock exam (40 questions, 60 minutes).'),
        h('a', { class: 'btn btn--primary', href: `#/${env}/mock` }, 'Go to mocks'),
      ];
    case 'ready':
      return [h('p', { 'data-testid': 'istqb-next' }, 'Readiness gate met: two full mocks in a row at 80 % or more. Book the exam!')];
    default:
      return [h('p', { 'data-testid': 'istqb-next' }, 'More lessons are on the way. Meanwhile: flashcards, wrong-answer review, or a mock.')];
  }
}

/** The engine's homeCards hook: the ISTQB summary card. */
export async function homeCards(ctx, course, data) {
  const { objectives } = await getExtras();
  const done = chaptersDone(data);
  const r = readiness(data);
  const days = daysSinceLastSession(data);
  const wrong = wrongAnswers(data).length;
  const byCh = masteryByChapter(data, objectives);
  const step = objectives.length ? nextStep(course, data, objectives) : { kind: 'waiting' };
  return h(
    'section',
    { class: 'card', 'data-testid': 'istqb-summary' },
    h('h2', {}, 'CTFL v4.0'),
    h('p', { class: 'big', 'data-testid': 'istqb-chapters' }, `Chapters ${done.length}/6`),
    h('div', { class: 'chips' }, CHAPTERS.map((c) => h('span', { class: `chip${done.includes(c) ? ' chip--exam-ready' : ''}` }, `${done.includes(c) ? '✓' : '·'} Ch${c}`))),
    h(
      'p',
      { 'data-testid': 'istqb-readiness' },
      h('strong', {}, `Readiness: ${r.level}. `),
      r.gateMet
        ? 'Gate met.'
        : `The gate: two full mocks in a row at ${READY_MARK} % or more${r.recentFullMocks.length ? ` (recent: ${r.recentFullMocks.map((s) => `${s} %`).join(', ')})` : ' (none yet)'}.`,
    ),
    nextStepView(step, data, ctx.moduleId || 'istqb'),
    days !== null
      ? h(
          'p',
          { class: 'muted', 'data-testid': 'istqb-gap' },
          `Last session: ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}.`,
          needsWarmup(data) && !data.activeSession ? ' More than 10 days: the next session opens with a 5-question warm-up.' : '',
        )
      : null,
    objectives.length
      ? h(
          'div',
          { class: 'istqb-mastery', 'data-testid': 'istqb-mastery' },
          h('h3', { class: 'istqb-mastery__title' }, 'Mastery by chapter'),
          // A bar per chapter: exam-ready, solid, shaky, untested, in proportion; the counts in words for screen readers.
          CHAPTERS.map((c) => {
            const counts = byCh[c];
            const total = MASTERY.reduce((n, m) => n + (counts[m] || 0), 0) || 1;
            const words = [...MASTERY].reverse().filter((m) => counts[m]).map((m) => `${MASTERY_ICON[m]} ${counts[m]} ${m}`).join(' · ');
            return h(
              'div',
              { class: 'mbar' },
              h('span', { class: 'mbar__ch' }, `Ch${c}`),
              h(
                'span',
                { class: 'mbar__bar', role: 'img', 'aria-label': `Chapter ${c}: ${words}` },
                [...MASTERY].reverse().filter((m) => counts[m]).map((m) => h('span', { class: `mbar__seg mbar__seg--${m}`, style: `flex:${counts[m] / total}` })),
              ),
              h('span', { class: 'mbar__words' }, words),
            );
          }),
          h('p', { class: 'muted mbar__legend' }, [...MASTERY].reverse().map((m) => h('span', { class: 'mbar__key' }, h('span', { class: `mbar__dot mbar__seg--${m}` }), m))),
        )
      : null,
    h('a', { class: 'btn', href: '#/istqb/review', 'data-testid': 'istqb-review-link' }, `Wrong answers (${wrong})`),
  );
}

// ---------- wrong-answer review ----------

/**
 * A practice session (the engine's activeSession shape, review drill steps only, no lesson) on the
 * questions answered wrong last time, then one question for each objective of an imported wrong
 * answer (its own question is not in the bank). Pure apart from rng.
 */
export function buildRetrySession(course, data, { size = 10, now = Date.now(), rng = Math.random } = {}) {
  const stats = questionStats(data.attempts);
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  const picked = [];
  const used = new Set();
  for (const a of wrongAnswers(data)) {
    if (picked.length >= size) break;
    let q = byId.get(a.questionId);
    if (q && stats[q.id]?.lastCorrect !== false) continue; // answered right since then
    if (!q) [q] = pickQuestions(course.questions.filter((x) => x.objective === a.objective && !used.has(x.id)), 1, { stats, progress: data }, rng);
    if (!q || used.has(q.id)) continue;
    used.add(q.id);
    picked.push(q);
  }
  return {
    no: nextSessionNo(data),
    kind: 'lesson',
    review: true,
    startedAt: new Date(now).toISOString(),
    lessonId: null,
    steps: picked.map((q) => ({ type: 'drill', questionId: q.id, label: 'Wrong-answer retry' })),
    index: 0,
    answers: {},
  };
}

/** #/istqb/review. `study` is the module (for getCourse). */
export async function renderReview(ctx, study) {
  const { course } = await study.getCourse();
  const data = ctx.data;
  const list = wrongAnswers(data);
  const byId = new Map(course.questions.map((q) => [q.id, q]));
  const item = (a) => {
    const q = byId.get(a.questionId);
    if (q) return questionView({ question: q, chosen: a.chosen ?? null, label: `Session ${a.sessionNo} · ${a.kind}` });
    return h(
      'section',
      { class: 'card', 'data-testid': 'legacy-wrong' },
      h('p', { class: 'kicker' }, `Session ${a.sessionNo} · ${a.objective} · from the Claude Project`),
      h('p', { class: 'feedback-item__text' }, a.legacyText || 'No text was kept for this answer.'),
    );
  };
  const retry = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--primary',
      'data-testid': 'review-retry',
      onclick: async () => {
        if (ctx.readOnly) return toast('Read-only until the app updates: nothing was saved.');
        if (data.activeSession) return toast('Finish or stop the session in progress first.');
        const session = buildRetrySession(course, data);
        if (!session.steps.length) return toast('No questions to retry yet.');
        await ctx.save({ ...data, activeSession: session });
        ctx.navigate('#/istqb/session');
      },
    },
    'Retry my wrong answers',
  );
  mount(
    ctx.root,
    h(
      'div',
      { class: 'stack study', 'data-testid': 'istqb-review' },
      h('a', { class: 'btn', href: '#/istqb' }, '← Back to the course'),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, `Wrong answers (${list.length})`),
        h('p', { class: 'muted' }, 'Newest first. Answers from the Claude Project keep their text; retrying uses fresh questions on the same objective.'),
        list.length ? retry : null,
      ),
      list.length ? list.map(item) : h('p', { class: 'card muted' }, 'No wrong answers yet.'),
    ),
  );
}
