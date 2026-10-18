// The Bulgarian module's own screens on top of the engine's (cards and feedback are the engine's):
// the home (#/bulgarian), the alphabet (#/bulgarian/alphabet) and a practice round
// (#/bulgarian/practice/<to-sound | to-letter | reading>). Lessons wait for the course book (Q-4).
import { h, mount } from '../../core/dom.js';
import { speakButton } from '../../core/speech.js';
import { askButtons, feedbackBox, store, tabs, toast } from '../../core/study/screens.js';
import { buildAskMessage } from '../../core/study/ask-claude.js';
import { isResolved } from '../../core/study/progress.js';
import { dueSides, localDate } from '../../core/study/scheduler.js';
import { MODES, buildRound, letterLearned, lettersLearned, recordAnswer, removeHomeCard, streak, wordsLearned } from './data.js';
import { getTrainer } from './content.js';

export const ID = 'bulgarian';
export const NAME = 'Bulgarian';
export const TABS = [
  ['', 'Home'],
  ['alphabet', 'Alphabet'],
  ['cards', 'Cards'],
  ['feedback', 'Feedback'],
];
export const CARDS = { newPerDay: 10 };
/** The voice the 🔊 buttons ask for. */
export const VOICE = 'bg-BG';
const ENV = { id: ID, name: NAME, config: { tabs: TABS } };
const COURSE = { name: NAME };

const say = (text) => speakButton(text, VOICE);
const bgText = (tag, attrs, value) => h(tag, { lang: 'bg', ...attrs }, value);

function problemsNote(problems) {
  if (!problems.length) return null;
  return h(
    'details',
    { class: 'card card--warn', 'data-testid': 'content-problems' },
    h('summary', {}, `${problems.length} content problem${problems.length === 1 ? '' : 's'}: some items are skipped`),
    h('ul', { class: 'list' }, problems.slice(0, 50).map((p) => h('li', {}, p))),
  );
}

const letterAsk = (l) => ({ kind: 'card', card: { topic: 'Cyrillic alphabet', front: `${l.upper} ${l.lower}`, back: `${l.sound}. ${l.approx}${l.russian ? ` ${l.russian}` : ''}` }, reverse: false });
const wordAsk = (w) => ({ kind: 'card', card: { topic: `reading practice (${w.topic})`, front: w.bg, back: `${w.latin}: ${w.en}` }, reverse: false });

// ---------- home ----------

/** study: the module (for getCourse). */
export async function renderHome(ctx, study) {
  const [{ course, problems }, tr] = await Promise.all([study.getCourse(), getTrainer()]);
  const st = store(ctx);
  const draw = () => {
    const p = st.data;
    const today = localDate();
    const cards = [...course.cards, ...p.homeDeck];
    const due = dueSides(cards, p.cardState, today, CARDS).length;
    const days = streak(p, today);
    const openFeedback = p.feedback.filter((f) => !isResolved(f, tr.handled)).length;
    const letters = tr.alphabet.letters;
    const deckList = p.homeDeck.length
      ? h(
          'ul',
          { class: 'list bg-deck', 'data-testid': 'bg-home-deck' },
          p.homeDeck.map((c) =>
            h(
              'li',
              { class: 'bg-deck__item', 'data-testid': 'bg-home-word' },
              h('span', {}, bgText('strong', {}, c.front), ` — ${c.back}`),
              h(
                'span',
                { class: 'row' },
                say(c.front),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'btn',
                    'aria-label': `Remove ${c.front}`,
                    onclick: async () => {
                      if (!window.confirm(`Remove "${c.front}" and its review history from your cards?`)) return;
                      if (await st.commit(removeHomeCard(st.data, c.id))) draw();
                    },
                  },
                  'Remove',
                ),
              ),
            ),
          ),
        )
      : h('p', { class: 'muted', 'data-testid': 'bg-home-empty' }, 'Words you add from the Fridge (after adding an item: 🇧🇬 Learn its Bulgarian name) become two-way cards here.');

    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'bg-home', 'data-module': ID },
        tabs(ENV, ''),
        problemsNote([...problems, ...tr.problems]),
        course.lessons.length
          ? null
          : h(
              'section',
              { class: 'card card--warn', 'data-testid': 'bg-book-panel' },
              h('h2', {}, '📖 Lessons start when your course book is added'),
              h(
                'p',
                {},
                'The lessons, their vocabulary and the chapter quizzes will follow your course book, chapter by chapter. Until the book is here: learn the 30 letters, practise reading, and review the words from your home.',
              ),
            ),
        h(
          'section',
          { class: 'card', 'data-testid': 'bg-stats' },
          h('h2', {}, 'Progress'),
          h('p', { 'data-testid': 'bg-words-learned' }, `Words learned: ${wordsLearned(cards, p.cardState)} of ${cards.length}`),
          h('p', { 'data-testid': 'bg-streak' }, `Streak: ${days} day${days === 1 ? '' : 's'}`),
          h('p', { 'data-testid': 'bg-alphabet-progress' }, `Alphabet: ${lettersLearned(p, letters)}/${letters.length} letters learned`),
          h('a', { class: 'btn btn--primary', href: `#/${ID}/cards`, 'data-testid': 'bg-cards-link' }, `Cards (${due} due)`),
          h('a', { class: 'btn', href: `#/${ID}/alphabet` }, 'Alphabet'),
        ),
        h('section', { class: 'card' }, h('h2', {}, `🏠 From my home (${p.homeDeck.length})`), deckList),
        h('a', { class: 'btn', href: `#/${ID}/feedback` }, `Feedback (${openFeedback} open)`),
      ),
    );
  };
  draw();
}

// ---------- alphabet ----------

export async function renderAlphabet(ctx) {
  const tr = await getTrainer();
  const st = store(ctx);
  const letters = tr.alphabet.letters;
  mount(
    ctx.root,
    h(
      'div',
      { class: 'stack study', 'data-testid': 'bg-alphabet' },
      tabs(ENV, 'alphabet'),
      problemsNote(tr.problems),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Practise'),
        h('p', { 'data-testid': 'bg-alphabet-progress' }, `${lettersLearned(st.data, letters)}/${letters.length} letters learned (right twice in a row, both ways)`),
        Object.entries(MODES).map(([mode, m]) => h('a', { class: 'btn btn--primary', href: `#/${ID}/practice/${mode}`, 'data-testid': `practice-${mode}` }, m.label)),
      ),
      h('section', { class: 'card' }, h('h2', {}, 'Good to know'), h('ul', { class: 'list' }, tr.alphabet.notes.map((n) => h('li', {}, n)))),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, `The ${letters.length} letters`),
        letters.map((l) =>
          h(
            'details',
            { class: 'bg-letter', 'data-testid': 'bg-letter', 'data-letter': l.id },
            h('summary', {}, bgText('span', { class: 'bg-letter__glyph' }, `${l.upper} ${l.lower}`), ` ${l.sound}${letterLearned(st.data, l.id) ? ' ✓' : ''}`),
            h('p', {}, l.approx),
            l.russian ? h('p', { class: 'bg-russian' }, h('strong', {}, 'If you know Russian: '), l.russian) : null,
            h('p', {}, 'Example: ', bgText('strong', {}, l.example.bg), ` (${l.example.latin}) — ${l.example.en} `, say(l.example.bg)),
            askButtons(ctx, () => buildAskMessage(COURSE, letterAsk(l))),
            feedbackBox(st, { targetId: `letter-${l.id}`, targetKind: 'letter' }),
          ),
        ),
      ),
    ),
  );
}

// ---------- practice round ----------

/** rng: tests may pass a seeded random function. */
export async function renderPractice(ctx, { rng = Math.random } = {}) {
  const tr = await getTrainer();
  const mode = ctx.params;
  if (!MODES[mode]) {
    return mount(ctx.root, h('section', { class: 'card card--warn' }, h('h2', {}, 'No such practice'), h('a', { class: 'btn', href: `#/${ID}/alphabet` }, 'Back to the alphabet')));
  }
  const st = store(ctx);
  const letters = tr.alphabet.letters;
  const words = tr.reading;
  const byId = new Map((mode === 'reading' ? words : letters).map((x) => [x.id, x]));
  const round = buildRound(mode, { letters, words }, st.data, rng);
  const results = [];
  let index = 0;

  const promptOf = (it) =>
    mode === 'to-sound' ? bgText('p', { class: 'bg-prompt', 'data-testid': 'practice-prompt' }, `${it.upper} ${it.lower}`)
    : mode === 'to-letter' ? h('p', { class: 'bg-prompt bg-prompt--small', 'data-testid': 'practice-prompt' }, it.sound)
    : bgText('p', { class: 'bg-prompt', 'data-testid': 'practice-prompt' }, it.bg);
  const optionText = (it) => (mode === 'to-sound' ? it.sound : mode === 'to-letter' ? `${it.upper} ${it.lower}` : it.latin);
  const question = { 'to-sound': 'How does this letter sound?', 'to-letter': 'Which letter makes this sound?', reading: 'How do you read this word?' }[mode];

  const explain = (it) =>
    mode === 'reading'
      ? [h('p', {}, bgText('strong', {}, it.bg), ` = ${it.latin}: ${it.en} `, say(it.bg)), it.note ? h('p', { class: 'muted' }, it.note) : null]
      : [
          h('p', {}, bgText('strong', {}, `${it.upper} ${it.lower}`), `: ${it.approx}`),
          it.russian ? h('p', { class: 'bg-russian' }, h('strong', {}, 'If you know Russian: '), it.russian) : null,
          h('p', {}, 'Example: ', bgText('strong', {}, it.example.bg), ` (${it.example.latin}) — ${it.example.en} `, say(it.example.bg)),
        ];

  const summary = () => {
    const right = results.filter((r) => r.correct).length;
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'practice-summary' },
        tabs(ENV, 'alphabet'),
        h(
          'section',
          { class: 'card' },
          h('h2', {}, `${MODES[mode].label}: done`),
          h('p', { class: 'big', 'data-testid': 'practice-score' }, `${right}/${results.length}`),
          h(
            'ul',
            { class: 'list' },
            results.map((r) => h('li', {}, `${r.correct ? '✓' : '✗'} `, bgText('span', {}, mode === 'reading' ? r.it.bg : `${r.it.upper} ${r.it.lower}`), ` — ${optionText(r.it)}`)),
          ),
          h('button', { type: 'button', class: 'btn btn--primary', 'data-testid': 'practice-again', onclick: () => renderPractice({ ...ctx, data: st.data }, { rng }) }, 'Another round'),
          h('a', { class: 'btn', href: `#/${ID}/alphabet`, 'data-testid': 'practice-back' }, 'Back to the alphabet'),
        ),
      ),
    );
  };

  const draw = (chosen) => {
    const q = round[index];
    if (!q) return summary();
    const it = byId.get(q.id);
    const answered = chosen !== undefined;
    const options = q.options.map((oid, i) => {
      const o = byId.get(oid);
      const cls = ['option'];
      if (answered && oid === q.id) cls.push('option--correct');
      else if (answered && oid === chosen) cls.push('option--wrong');
      return h(
        'button',
        {
          type: 'button',
          class: cls.join(' '),
          disabled: answered,
          'data-testid': `choice-${i}`,
          lang: mode === 'to-letter' ? 'bg' : null,
          onclick: async () => {
            const correct = oid === q.id;
            results.push({ it, correct });
            // Saved at once; when read-only the round goes on unsaved (the toast says so).
            await st.commit(recordAnswer(st.data, mode, q.id, correct, localDate()));
            draw(oid);
          },
        },
        h('span', { class: 'option__text' }, optionText(o)),
      );
    });
    const right = chosen === q.id;
    mount(
      ctx.root,
      h(
        'div',
        { class: 'stack study', 'data-testid': 'practice' },
        tabs(ENV, 'alphabet'),
        h('p', { class: 'kicker', 'data-testid': 'practice-progress' }, `${MODES[mode].label} · ${index + 1} of ${round.length}`),
        h(
          'section',
          { class: 'card question', 'data-answered': String(answered) },
          h('p', { class: 'muted' }, question),
          promptOf(it),
          h('div', { class: 'options', role: 'group', 'aria-label': 'Options' }, options),
          answered
            ? [
                h(
                  'div',
                  { class: `verdict ${right ? 'verdict--right' : 'verdict--wrong'}`, role: 'status', 'data-testid': 'practice-verdict' },
                  h('strong', {}, right ? '✓ Right.' : '✗ Not quite.'),
                  right ? '' : ` It is: ${optionText(it)}`,
                ),
                explain(it),
                askButtons(ctx, () => buildAskMessage(COURSE, mode === 'reading' ? wordAsk(it) : letterAsk(it))),
                feedbackBox(st, mode === 'reading' ? { targetId: `word-${it.id}`, targetKind: 'word' } : { targetId: `letter-${it.id}`, targetKind: 'letter' }),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'btn btn--primary',
                    'data-testid': 'practice-next',
                    onclick: () => {
                      index += 1;
                      draw();
                      window.scrollTo(0, 0);
                    },
                  },
                  index + 1 < round.length ? 'Next' : 'See results',
                ),
              ]
            : null,
        ),
        h('a', { class: 'btn', href: `#/${ID}/alphabet`, 'data-testid': 'practice-stop' }, 'Stop (answers are saved)'),
      ),
    );
  };

  if (!round.length) {
    toast('Not enough content to practise yet.');
    return mount(ctx.root, h('section', { class: 'card card--warn', 'data-testid': 'practice-empty' }, h('h2', {}, 'Nothing to practise yet'), h('a', { class: 'btn', href: `#/${ID}/alphabet` }, 'Back to the alphabet')));
  }
  draw();
}

/** Titles in the engine's Feedback list for the trainer's own targets. */
export function feedbackTitle(f, tr) {
  if (f.targetKind === 'letter') {
    const l = tr.alphabet.letters.find((x) => `letter-${x.id}` === f.targetId);
    return l ? `Letter ${l.upper} ${l.lower}` : null;
  }
  if (f.targetKind === 'word') {
    const w = tr.reading.find((x) => `word-${x.id}` === f.targetId);
    return w ? `Reading word ${w.bg}` : null;
  }
  return null;
}
