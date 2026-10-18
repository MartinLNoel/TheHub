// The study engine's screens, shared by every study module (ISTQB, Bulgarian): course home, lesson
// reader, session runner, question runner, mock runner, flashcards and the feedback list.
// Each takes the route context ({ root, data, readOnly, save, navigate, settings, params }) plus the
// study module's `env` ({ id, name, config, getCourse }).
import { h, mount } from '../dom.js';
import { LETTERS, kLevelsByObjective } from './content.js';
import { renderMarkdown } from './markdown.js';
import { askClaudeButtons, buildAskMessage, DEFAULT_DELIVERY } from './ask-claude.js';
import { MASTERY, addFeedback, dueReviews, isResolved, masteryOf, masterySummary, nextSessionNo, setFeedbackResolved } from './progress.js';
import { advance, answerStep, buildSession, currentStep, finishSession, nextLesson } from './session.js';
import { answerMock, finishMock, formatClock, isExpired, moveMock, remainingMs, startMock } from './mock.js';
import { dueSides, gradeSide, localDate } from './scheduler.js';

const STEP_LABEL = { drill: 'Review drill', lesson: 'Lesson', quiz: 'Quiz', retrieval: 'Delayed retrieval' };
const MASTERY_ICON = { untested: '○', shaky: '◐', solid: '●', 'exam-ready': '★' };

// ---------- shared pieces ----------

let toastTimer = null;
export function toast(msg) {
  let el = document.getElementById('study-toast');
  if (!el) {
    el = h('div', { id: 'study-toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/** Keeps the latest data and saves through the context; refuses politely when read-only. */
export function store(ctx) {
  const s = {
    data: ctx.data,
    async commit(next) {
      if (ctx.readOnly) {
        toast('Read-only until the app updates: nothing was saved.');
        return false;
      }
      await ctx.save(next);
      s.data = next;
      return true;
    },
  };
  return s;
}

/** The engine's sub-tabs; a course may list its own with `config.tabs` ([route, label] pairs). */
export const DEFAULT_TABS = [
  ['', 'Home'],
  ['lessons', 'Lessons'],
  ['cards', 'Cards'],
  ['mock', 'Mocks'],
  ['feedback', 'Feedback'],
];

/** The course's sub-tab bar (exported for module screens; env needs id, name and config). */
export function tabs(env, current) {
  const items = env.config?.tabs || DEFAULT_TABS;
  return h(
    'nav',
    { class: 'subtabs', 'aria-label': `${env.name} screens` },
    items.map(([route, label]) =>
      h('a', { class: 'subtab', href: route ? `#/${env.id}/${route}` : `#/${env.id}`, 'aria-current': route === current ? 'page' : null }, label),
    ),
  );
}

function problemsNote(problems) {
  if (!problems.length) return null;
  return h(
    'details',
    { class: 'card card--warn', 'data-testid': 'content-problems' },
    h('summary', {}, `${problems.length} content problem${problems.length === 1 ? '' : 's'}: some items are skipped`),
    h('ul', { class: 'list' }, problems.slice(0, 50).map((p) => h('li', {}, p))),
  );
}

function chip(text, cls = '') {
  return h('span', { class: `chip ${cls}`.trim() }, text);
}

function objectiveChips(objectives, course, progress) {
  const k = kLevelsByObjective(course.questions);
  return h(
    'div',
    { class: 'chips', 'data-testid': 'objective-chips' },
    objectives.map((o) => {
      const m = progress ? masteryOf(progress, o) : null;
      return chip(`${o}${k[o] ? ` · ${k[o]}` : ''}${m ? ` ${MASTERY_ICON[m]}` : ''}`, m ? `chip--${m}` : '');
    }),
  );
}

/** The Feedback button and its inline form. targetKind: lesson | question | card (a module may add its own). */
export function feedbackBox(st, { targetId, targetKind }) {
  const area = h('textarea', { class: 'input', rows: '3', 'data-testid': 'feedback-text', 'aria-label': 'Your feedback' });
  const form = h(
    'div',
    { class: 'feedback-form', hidden: true },
    h('label', { class: 'muted' }, 'What is wrong or unclear? It is saved with your progress (and backups).'),
    area,
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          'data-testid': 'feedback-save',
          onclick: async () => {
            if (!area.value.trim()) return toast('Write something first.');
            const next = addFeedback(st.data, { targetId, targetKind, text: area.value });
            if (await st.commit(next)) {
              area.value = '';
              form.hidden = true;
              toast('Feedback saved');
            }
          },
        },
        'Save feedback',
      ),
      h('button', { type: 'button', class: 'btn', onclick: () => (form.hidden = true) }, 'Cancel'),
    ),
  );
  return h(
    'div',
    { class: 'feedback' },
    h(
      'button',
      {
        type: 'button',
        class: 'btn',
        'data-testid': 'feedback-button',
        onclick: () => {
          form.hidden = !form.hidden;
          if (!form.hidden) area.focus();
        },
      },
      '📝 Feedback',
    ),
    form,
  );
}

export function askButtons(ctx, makeMessage) {
  return askClaudeButtons({ makeMessage, delivery: ctx.settings?.askClaude || DEFAULT_DELIVERY, toast });
}

const lessonOf = (course, question) => course.lessons.find((l) => l.objectives.includes(question.objective)) || null;

// ---------- question runner ----------

/**
 * One question. Before `chosen` is given, the DOM holds ONLY the stem and the four options: no
 * answer, hint, explanation or marker of the correct option (a unit test checks this).
 * onSubmit(letter) is called once; the caller re-renders with chosen set.
 * reveal(): extra nodes for the answered state (Ask Claude, Feedback, Next).
 */
export function questionView({ question, chosen, onSubmit, reveal, label }) {
  const answered = chosen !== undefined;
  let selected = null;
  const submit = h('button', { type: 'button', class: 'btn btn--primary', disabled: true, 'data-testid': 'q-submit' }, 'Submit answer');
  const options = LETTERS.map((L, i) => {
    const cls = ['option'];
    if (answered) {
      if (L === question.answer) cls.push('option--correct');
      else if (L === chosen) cls.push('option--wrong');
    }
    const btn = h(
      'button',
      {
        type: 'button',
        class: cls.join(' '),
        role: 'radio',
        'aria-checked': answered ? String(L === chosen) : 'false',
        disabled: answered,
        'data-option': L,
        'data-testid': `option-${L}`,
        onclick: () => {
          selected = L;
          for (const b of optionList.children) b.setAttribute('aria-checked', String(b.dataset.option === L));
          submit.disabled = false;
        },
      },
      h('span', { class: 'option__letter' }, `${L}`),
      h('span', { class: 'option__text' }, question.options[i]),
    );
    return btn;
  });
  const optionList = h('div', { class: 'options', role: 'radiogroup', 'aria-label': 'Options' }, options);
  submit.addEventListener('click', () => {
    if (selected && !submit.disabled) {
      submit.disabled = true;
      onSubmit(selected);
    }
  });

  const parts = [
    label ? h('p', { class: 'kicker' }, label) : null,
    h('p', { class: 'stem', 'data-testid': 'q-stem' }, question.stem),
    h('p', { class: 'muted' }, 'Select ONE option.'),
    optionList,
  ];
  if (!answered) parts.push(submit);
  else {
    const right = chosen === question.answer;
    parts.push(
      h(
        'div',
        { class: `verdict ${right ? 'verdict--right' : 'verdict--wrong'}`, 'data-testid': 'q-verdict', role: 'status' },
        h('strong', {}, right ? '✓ Correct.' : chosen ? `✗ Not quite: you chose ${chosen}.` : '✗ Not answered.'),
        ` The answer is ${question.answer}.`,
      ),
      h('p', { 'data-testid': 'q-why' }, h('strong', {}, 'Why: '), question.why),
      h(
        'ul',
        { class: 'list distractors' },
        LETTERS.filter((L) => L !== question.answer).map((L) => h('li', {}, h('strong', {}, `${L}: `), question.distractorNotes[L])),
      ),
      h('p', { class: 'muted' }, `${question.objective} · ${question.kLevel}`),
      reveal ? reveal() : null,
    );
  }
  return h('section', { class: 'card question', 'data-testid': 'question', 'data-answered': String(answered) }, parts);
}

// ---------- lesson reader ----------

export function lessonView(ctx, env, st, course, lesson, extra = null) {
  return h(
    'article',
    { class: 'card lesson', 'data-testid': 'lesson', 'data-lesson': lesson.id },
    h('p', { class: 'kicker' }, `Chapter ${lesson.chapter} · Section ${lesson.section}`),
    h('h2', {}, lesson.title),
    objectiveChips(lesson.objectives, course, st.data),
    h('div', { class: 'md' }, renderMarkdown(lesson.body)),
    askButtons(ctx, () => buildAskMessage({ name: env.name }, { kind: 'lesson', lesson })),
    feedbackBox(st, { targetId: lesson.id, targetKind: 'lesson' }),
    extra,
  );
}

// ---------- home ----------

export async function renderHome(ctx, env) {
  const { course, problems } = await env.getCourse();
  const st = store(ctx);
  const p = st.data;
  const no = nextSessionNo(p);
  const lesson = nextLesson(course, p);
  const reviewDue = dueReviews(p, p.activeSession?.no ?? no).length;
  const cardsDue = dueSides(env.allCards(course, p), p.cardState, localDate(), env.config.cards).length;
  const objectives = [...new Set([...course.lessons.flatMap((l) => l.objectives), ...course.questions.map((q) => q.objective)])];
  const summary = masterySummary(p, objectives);
  const openFeedback = p.feedback.filter((f) => !isResolved(f, env.handled())).length;

  const s = p.activeSession;
  const sessionCard = h(
    'section',
    { class: 'card', 'data-testid': 'study-session-card' },
    h('h2', {}, s ? `Session ${s.no} in progress` : `Session ${no}`),
    s
      ? h('p', {}, `Step ${Math.min(s.index + 1, s.steps.length)} of ${s.steps.length}. Your answers so far are saved.`)
      : h('p', {}, lesson ? `Next lesson: ${lesson.section} ${lesson.title}` : 'All lessons done: the session reviews your weakest objectives.'),
    h('p', { class: 'muted' }, `Review items due: ${reviewDue}`),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary',
        'data-testid': s ? 'study-resume' : 'study-start',
        onclick: async () => {
          if (!s) {
            let session = buildSession(course, st.data, env.config.session);
            if (env.config.adjustSession) session = env.config.adjustSession(session, course, st.data);
            if (!session.steps.length) return toast('Nothing to study yet: the course has no content.');
            if (!(await st.commit({ ...st.data, activeSession: session }))) return;
          }
          ctx.navigate(`#/${env.id}/session`);
        },
      },
      s ? 'Resume session' : 'Start session',
    ),
  );

  const m = p.activeMock;
  const extraCards = env.config.homeCards ? await env.config.homeCards(ctx, course, p) : null;
  mount(
    ctx.root,
    h(
      'div',
      { class: 'stack study', 'data-testid': 'study-home', 'data-module': env.id },
      tabs(env, ''),
      problemsNote(problems),
      extraCards,
      sessionCard,
      m
        ? h(
            'section',
            { class: 'card card--warn' },
            h('h2', {}, `${m.label} in progress`),
            h('p', {}, isExpired(m) ? 'Time is up: see your results.' : `${formatClock(remainingMs(m))} left.`),
            h('a', { class: 'btn btn--primary', href: `#/${env.id}/mock`, 'data-testid': 'mock-resume' }, isExpired(m) ? 'See results' : 'Resume mock'),
          )
        : null,
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Mastery'),
        h(
          'p',
          { 'data-testid': 'mastery-summary' },
          MASTERY.map((lvl) => `${MASTERY_ICON[lvl]} ${lvl} ${summary[lvl]}`).join(' · '),
        ),
        h('a', { class: 'btn', href: `#/${env.id}/cards` }, `Flashcards (${cardsDue} due)`),
        h('a', { class: 'btn', href: `#/${env.id}/feedback` }, `Feedback (${openFeedback} open)`),
      ),
    ),
  );
}

// ---------- session runner ----------

export async function renderSession(ctx, env) {
  const { course } = await env.getCourse();
  const st = store(ctx);

  const draw = () => {
    const s = st.data.activeSession;
    if (!s) {
      return mount(
        ctx.root,
        h(
          'div',
          { class: 'stack study' },
          tabs(env, 'session'),
          h(
            'section',
            { class: 'card', 'data-testid': 'study-no-session' },
            h('h2', {}, 'No session in progress'),
            h('a', { class: 'btn btn--primary', href: `#/${env.id}` }, 'Back to the course'),
          ),
        ),
      );
    }
    const step = currentStep(s);
    if (!step) return debrief();
    const gone = step.lessonId ? !course.lessons.some((l) => l.id === step.lessonId) : !course.questions.some((q) => q.id === step.questionId);
    if (gone) {
      // The content changed since the session started: skip the step.
      st.data = advance(st.data, course);
      return draw();
    }
    const head = h(
      'div',
      { class: 'study-head' },
      h('p', { class: 'kicker', 'data-testid': 'session-progress' }, `Session ${s.no} · Step ${s.index + 1} of ${s.steps.length} · ${step.label || STEP_LABEL[step.type]}`),
      h(
        'div',
        { class: 'row' },
        h('a', { class: 'btn', href: `#/${env.id}`, 'data-testid': 'session-stop' }, 'Stop (saved)'),
        h('button', { type: 'button', class: 'btn', 'data-testid': 'session-finish-now', onclick: () => debrief() }, 'Finish now'),
      ),
    );
    const next = async () => {
      if (await st.commit(advance(st.data, course))) draw();
      window.scrollTo(0, 0);
    };
    let body;
    if (step.type === 'lesson') {
      const lesson = course.lessons.find((l) => l.id === step.lessonId);
      body = lessonView(ctx, env, st, course, lesson, h('button', { type: 'button', class: 'btn btn--primary', 'data-testid': 'session-next', onclick: next }, 'Continue'));
    } else {
      const question = course.questions.find((q) => q.id === step.questionId);
      const chosen = s.answers[s.index];
      body = questionView({
        question,
        chosen,
        label: step.label || STEP_LABEL[step.type],
        onSubmit: async (letter) => {
          if (await st.commit(answerStep(st.data, course, letter))) draw();
        },
        reveal: () => [
          askButtons(ctx, () => buildAskMessage({ name: env.name }, { kind: 'question', question, chosen, lesson: lessonOf(course, question) })),
          feedbackBox(st, { targetId: question.id, targetKind: 'question' }),
          h('button', { type: 'button', class: 'btn btn--primary', 'data-testid': 'session-next', onclick: next }, 'Next'),
        ],
      });
    }
    mount(ctx.root, h('div', { class: 'stack study', 'data-testid': 'study-session' }, head, body));
  };

  const debrief = async () => {
    const { progress, debrief: d } = finishSession(st.data, course, { passMark: env.config.session?.passMark });
    if (!(await st.commit(progress))) return;
    const calib = {
      slow: 'Below the 65 % pass line: next time this lesson is taught again, with more foundational questions.',
      'on-pace': 'On pace: carry on with the plan.',
      accelerate: 'Above 85 %: the next questions get harder.',
    };
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'session-debrief' },
        h(
          'section',
          { class: 'card' },
          h('h2', {}, `Session ${d.no} debrief`),
          d.total
            ? h('p', { class: 'big', 'data-testid': 'debrief-score' }, `${d.correct}/${d.total} (${d.percent} %)`)
            : h('p', { 'data-testid': 'debrief-score' }, 'No quiz questions answered.'),
          d.calibration ? h('p', {}, calib[d.calibration]) : null,
          d.complete ? null : h('p', { class: 'muted' }, 'Stopped early: what you did is saved.'),
          h(
            'ul',
            { class: 'list' },
            [...d.drill, ...d.rows].map((r) =>
              h('li', {}, `${r.correct ? '✓' : '✗'} ${r.question.objective} (${r.question.kLevel}) — ${r.label || STEP_LABEL[r.type]}`),
            ),
          ),
          d.changes.length
            ? h('div', {}, h('h3', {}, 'Mastery changes'), h('ul', { class: 'list', 'data-testid': 'debrief-changes' }, d.changes.map((c) => h('li', {}, `${c.objective}: ${c.from} → ${c.to}`))))
            : null,
          h('p', { 'data-testid': 'debrief-next' }, d.nextLesson ? `Next session: ${d.nextLesson.section} ${d.nextLesson.title}` : 'Next session: review of your weakest objectives.'),
          h('a', { class: 'btn btn--primary', href: `#/${env.id}`, 'data-testid': 'debrief-done' }, 'Back to the course'),
        ),
      ),
    );
  };

  draw();
}

// ---------- lessons ----------

export async function renderLessons(ctx, env) {
  const { course } = await env.getCourse();
  const chapters = [...new Set(course.lessons.map((l) => l.chapter))];
  mount(
    ctx.root,
    h(
      'div',
      { class: 'stack study', 'data-testid': 'study-lessons' },
      tabs(env, 'lessons'),
      chapters.map((ch) =>
        h(
          'section',
          { class: 'card' },
          h('h2', {}, `Chapter ${ch}`),
          course.lessons
            .filter((l) => l.chapter === ch)
            .map((l) =>
              h(
                'a',
                { class: 'lesson-link', href: `#/${env.id}/lesson/${encodeURIComponent(l.id)}` },
                h('span', {}, `${l.section} ${l.title}`),
                objectiveChips(l.objectives, course, ctx.data),
              ),
            ),
        ),
      ),
      course.lessons.length ? null : h('p', { class: 'card muted' }, 'No lessons yet.'),
    ),
  );
}

export async function renderLesson(ctx, env) {
  const { course } = await env.getCourse();
  const lesson = course.lessons.find((l) => l.id === ctx.params);
  if (!lesson) {
    return mount(ctx.root, h('section', { class: 'card card--warn' }, h('h2', {}, 'Lesson not found'), h('a', { class: 'btn', href: `#/${env.id}/lessons` }, 'All lessons')));
  }
  const st = store(ctx);
  mount(ctx.root, h('div', { class: 'stack study' }, tabs(env, 'lessons'), lessonView(ctx, env, st, course, lesson)));
}

// ---------- mocks ----------

let mockTimer = null;

export async function renderMock(ctx, env) {
  const { course } = await env.getCourse();
  const st = store(ctx);
  clearInterval(mockTimer);

  const list = () => {
    const mocks = env.config.mocks || [];
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'mock-list' },
        tabs(env, 'mock'),
        mocks.map((m) =>
          h(
            'section',
            { class: 'card' },
            h('h2', {}, m.label),
            h('p', {}, `${m.count ?? Object.values(m.perChapter || {}).reduce((a, b) => a + b, 0)} questions · ${m.minutes} minutes · no feedback until the end`),
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn--primary',
                'data-testid': `mock-start-${m.id}`,
                onclick: async () => {
                  const mock = startMock(course, st.data, m);
                  if (!mock.questionIds.length) return toast('Not enough questions for this mock yet.');
                  if (await st.commit({ ...st.data, activeMock: mock })) run();
                },
              },
              'Start',
            ),
          ),
        ),
        mocks.length ? null : h('p', { class: 'card muted' }, 'This course has no mocks.'),
      ),
    );
  };

  const finish = async () => {
    clearInterval(mockTimer);
    if (!st.data.activeMock) return list();
    const { progress, debrief: d } = finishMock(st.data, course);
    if (!(await st.commit(progress))) return;
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'mock-debrief' },
        h(
          'section',
          { class: 'card' },
          h('h2', {}, `${d.label}: results`),
          h('p', { class: 'big', 'data-testid': 'mock-score' }, `${d.correct}/${d.total} (${d.percent} %)`),
          h('p', { class: 'muted' }, `${d.timedOut ? 'Time ran out. ' : ''}Time used: ${formatClock(d.elapsedMs)}`),
          h('h3', {}, 'By objective'),
          h(
            'table',
            { class: 'table', 'data-testid': 'mock-by-objective' },
            h('tbody', {}, Object.entries(d.byObjective).map(([o, r]) => h('tr', {}, h('td', {}, o), h('td', {}, `${r.correct}/${r.total}`)))),
          ),
          h('h3', {}, 'By chapter'),
          h('p', {}, Object.entries(d.byChapter).map(([c, r]) => `Ch${c}: ${r.correct}/${r.total}`).join(' · ')),
          h('a', { class: 'btn btn--primary', href: `#/${env.id}`, 'data-testid': 'mock-done' }, 'Back to the course'),
        ),
        h('h3', {}, 'Review'),
        d.rows.map((r) =>
          questionView({
            question: r.question,
            chosen: r.chosen,
            reveal: () => [
              askButtons(ctx, () => buildAskMessage({ name: env.name }, { kind: 'question', question: r.question, chosen: r.chosen, lesson: lessonOf(course, r.question) })),
              feedbackBox(st, { targetId: r.question.id, targetKind: 'question' }),
            ],
          }),
        ),
      ),
    );
  };

  const run = () => {
    const mock = st.data.activeMock;
    if (isExpired(mock)) return finish();
    const q = course.questions.find((x) => x.id === mock.questionIds[mock.index]);
    const clock = h('p', { class: 'clock', 'data-testid': 'mock-clock', role: 'timer' }, formatClock(remainingMs(mock)));
    const go = async (index) => {
      if (await st.commit(moveMock(st.data, index))) run();
    };
    const chosen = mock.answers[q.id];
    const options = h(
      'div',
      { class: 'options', role: 'radiogroup', 'aria-label': 'Options' },
      LETTERS.map((L, i) =>
        h(
          'button',
          {
            type: 'button',
            class: 'option',
            role: 'radio',
            'aria-checked': String(chosen === L),
            'data-testid': `option-${L}`,
            onclick: async () => {
              if (await st.commit(answerMock(st.data, q.id, L))) run();
            },
          },
          h('span', { class: 'option__letter' }, L),
          h('span', { class: 'option__text' }, q.options[i]),
        ),
      ),
    );
    const answeredCount = Object.keys(mock.answers).length;
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'mock-run' },
        h(
          'div',
          { class: 'study-head' },
          h('p', { class: 'kicker', 'data-testid': 'mock-progress' }, `${mock.label} · Question ${mock.index + 1} of ${mock.questionIds.length} · ${answeredCount} answered`),
          clock,
        ),
        h('section', { class: 'card question' }, h('p', { class: 'stem', 'data-testid': 'q-stem' }, q.stem), h('p', { class: 'muted' }, 'Select ONE option.'), options),
        h(
          'div',
          { class: 'row' },
          h('button', { type: 'button', class: 'btn', disabled: mock.index === 0, 'data-testid': 'mock-prev', onclick: () => go(mock.index - 1) }, '← Previous'),
          h('button', { type: 'button', class: 'btn', disabled: mock.index >= mock.questionIds.length - 1, 'data-testid': 'mock-next', onclick: () => go(mock.index + 1) }, 'Next →'),
        ),
        h(
          'div',
          { class: 'mock-grid', 'aria-label': 'Questions' },
          mock.questionIds.map((id, i) =>
            h('button', { type: 'button', class: `mock-dot${mock.answers[id] ? ' mock-dot--done' : ''}${i === mock.index ? ' mock-dot--here' : ''}`, onclick: () => go(i), 'aria-label': `Question ${i + 1}` }, String(i + 1)),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary',
            'data-testid': 'mock-submit',
            onclick: () => {
              const left = mock.questionIds.length - Object.keys(st.data.activeMock.answers).length;
              if (left && !window.confirm(`${left} question${left === 1 ? ' is' : 's are'} not answered and will count as wrong. Submit?`)) return;
              finish();
            },
          },
          'Submit mock',
        ),
      ),
    );
    // The clock shows endsAt − now, re-read every second and whenever the screen comes back.
    clearInterval(mockTimer);
    const tick = () => {
      if (!clock.isConnected) {
        clearInterval(mockTimer);
        document.removeEventListener('visibilitychange', tick);
        return;
      }
      const m = st.data.activeMock;
      if (!m) return;
      clock.textContent = formatClock(remainingMs(m));
      if (isExpired(m)) finish();
    };
    mockTimer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
  };

  if (st.data.activeMock) run();
  else list();
}

// ---------- flashcards ----------

export async function renderCards(ctx, env) {
  const { course } = await env.getCourse();
  const st = store(ctx);
  const today = localDate();
  const all = env.allCards(course, st.data);
  const queue = dueSides(all, st.data.cardState, today, env.config.cards);
  let flipped = false;

  const draw = () => {
    const side = queue[0];
    if (!side) {
      return mount(
        ctx.root,
        h(
          'div',
          { class: 'stack study' },
          tabs(env, 'cards'),
          h(
            'section',
            { class: 'card', 'data-testid': 'cards-done' },
            h('h2', {}, all.length ? 'All done for today' : 'No cards yet'),
            h('p', { class: 'muted' }, `${all.length} cards in this course.`),
          ),
        ),
      );
    }
    const { card, reverse } = side;
    const [front, back] = reverse ? [card.back, card.front] : [card.front, card.back];
    const [frontLang, backLang] = reverse ? [card.lang?.back, card.lang?.front] : [card.lang?.front, card.lang?.back];
    // A course may add something under a face's text (Bulgarian: the 🔊 button), via config.cardExtras.
    const faceExtras = (face, text, lang) => (env.config.cardExtras ? env.config.cardExtras({ card, reverse, face, text, lang: lang || null }) : null);
    const grade = (g) => async () => {
      let next = { ...st.data, cardState: gradeSide(st.data.cardState, side.key, g, today) };
      if (env.config.onCardGraded) next = env.config.onCardGraded(next, { key: side.key, grade: g, today });
      if (!(await st.commit(next))) return;
      queue.shift();
      if (g === 'again') queue.push(side); // shown again before the run ends
      flipped = false;
      draw();
    };
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'cards' },
        tabs(env, 'cards'),
        h('p', { class: 'kicker', 'data-testid': 'cards-left' }, `${queue.length} to go · ${card.topic}${reverse ? ' · reverse' : ''}`),
        h(
          'section',
          { class: 'card flashcard', 'data-testid': 'flashcard', 'data-card': side.key },
          h('p', { class: 'flashcard__text', lang: frontLang || null, 'data-testid': 'card-front' }, front),
          faceExtras('front', front, frontLang),
          flipped ? h('hr') : null,
          flipped ? h('p', { class: 'flashcard__text', lang: backLang || null, 'data-testid': 'card-back' }, back) : null,
          flipped ? faceExtras('back', back, backLang) : null,
        ),
        flipped
          ? h(
              'div',
              { class: 'grades', role: 'group', 'aria-label': 'How well did you know it?' },
              [
                ['again', 'Again'],
                ['hard', 'Hard'],
                ['good', 'Good'],
                ['easy', 'Easy'],
              ].map(([g, label]) => h('button', { type: 'button', class: 'btn', 'data-testid': `grade-${g}`, onclick: grade(g) }, label)),
            )
          : h('button', { type: 'button', class: 'btn btn--primary', 'data-testid': 'card-show', onclick: () => ((flipped = true), draw()) }, 'Show answer'),
        flipped ? askButtons(ctx, () => buildAskMessage({ name: env.name }, { kind: 'card', card, reverse })) : null,
        feedbackBox(st, { targetId: card.id, targetKind: 'card' }),
      ),
    );
  };
  draw();
}

// ---------- feedback list ----------

export async function renderFeedback(ctx, env) {
  const { course } = await env.getCourse();
  const st = store(ctx);
  const titleOf = (f) => {
    const own = env.config.feedbackTitle ? env.config.feedbackTitle(f) : null;
    if (own) return own;
    const l = course.lessons.find((x) => x.id === f.targetId);
    if (l) return `Lesson ${l.section} ${l.title}`;
    const q = course.questions.find((x) => x.id === f.targetId);
    if (q) return `Question ${q.id} (${q.objective})`;
    const c = env.allCards(course, st.data).find((x) => x.id === f.targetId);
    if (c) return `Card ${c.front}`;
    return f.targetId;
  };
  const draw = () => {
    const handled = env.handled();
    const notes = [...st.data.feedback].reverse();
    const item = (f) =>
      h(
        'li',
        { class: 'feedback-item', 'data-testid': 'feedback-item' },
        h('strong', {}, titleOf(f)),
        h('p', { class: 'feedback-item__text' }, f.text),
        h('p', { class: 'muted' }, new Date(f.at).toLocaleString()),
        handled.includes(f.id)
          ? h('p', { class: 'muted' }, 'Handled in a content update.')
          : h(
              'button',
              {
                type: 'button',
                class: 'btn',
                'data-testid': 'feedback-toggle',
                onclick: async () => {
                  if (await st.commit(setFeedbackResolved(st.data, f.id, !f.resolved))) draw();
                },
              },
              f.resolved ? 'Reopen' : 'Mark resolved',
            ),
      );
    const open = notes.filter((f) => !isResolved(f, handled));
    const done = notes.filter((f) => isResolved(f, handled));
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'feedback-list' },
        tabs(env, 'feedback'),
        h('section', { class: 'card' }, h('h2', {}, `Open (${open.length})`), open.length ? h('ul', { class: 'list', 'data-testid': 'feedback-open' }, open.map(item)) : h('p', { class: 'muted' }, 'No open feedback.')),
        h('section', { class: 'card' }, h('h2', {}, `Resolved (${done.length})`), done.length ? h('ul', { class: 'list', 'data-testid': 'feedback-resolved' }, done.map(item)) : h('p', { class: 'muted' }, 'Nothing resolved yet.')),
      ),
    );
  };
  draw();
}
