// The word of the day on the home screen (0.9.14; Martin, 2026-11-21: the word in English and Bulgarian "is not
// helping me with learning"; he chose the Latin form, the pronunciation with its stress and a 🔊, and a quiz before
// the meaning is shown). A todayWidget under "Today": the Bulgarian first, then "Show the meaning", then
// "I knew it" / "Not yet" ("Not yet" makes it a review card). The answer is kept for the day (data.wordOfDay).
import { h, mount } from '../../core/dom.js';
import { localDate } from '../../core/dates.js';
import { speakButton } from '../../core/speech.js';
import { answerWordOfDay, wordOfDayAnswer } from './data.js';

/** Letters whose sound an English speaker would not guess from the Latin form; their hint is shown. */
export const HINT_LETTERS = ['ъ', 'ж', 'х', 'ц', 'щ', 'й', 'р'];

/** The sound hints for a word: the alphabet's `sound` for each tricky letter in it, once each, in word order. */
export function soundHints(word, letters) {
  const byLower = new Map(letters.map((l) => [l.lower, l]));
  const seen = new Set();
  const hints = [];
  for (const ch of word.bg.toLowerCase()) {
    if (!HINT_LETTERS.includes(ch) || seen.has(ch) || !byLower.has(ch)) continue;
    seen.add(ch);
    const l = byLower.get(ch);
    hints.push(`${l.lower} = ${l.sound}`);
  }
  return hints;
}

/**
 * ctx: { data, readOnly, save } (the core's widget context). getWord(): { word, letters } once the reading words
 * are loaded, else null; load(): a promise of the same. contentCards(): the course's cards (no duplicates).
 */
export function wordOfDayWidget(ctx, { getWord, load, contentCards = () => [], voice = 'bg-BG', now = () => new Date() }) {
  let data = ctx.data;
  if (!data) return null;
  const body = h('div', { class: 'wotd__body' });
  const msg = h('p', { class: 'status status--bad', role: 'status', hidden: true, 'data-testid': 'wotd-msg' });
  const node = h(
    'section',
    { class: 'card wotd', 'data-module': 'bulgarian-word', 'data-testid': 'wotd' },
    h('h2', { class: 'wotd__title' }, h('span', { 'aria-hidden': 'true' }, '🇧🇬'), ' Word of the day'),
    body,
    msg,
  );

  const answer = async (word, knew) => {
    const next = answerWordOfDay(data, word, knew, { contentCards: contentCards(), now: now() });
    try {
      await ctx.save(next);
    } catch (err) {
      msg.hidden = false;
      msg.textContent = `Not saved: ${err.message}`;
      return;
    }
    msg.hidden = true;
    data = next;
    draw({ word, letters: current.letters }, true);
  };

  let current = null;
  const draw = (got, revealed = false) => {
    current = got;
    const { word, letters } = got;
    const done = wordOfDayAnswer(data, word.id, localDate(now()));
    const show = revealed || Boolean(done);
    const hints = soundHints(word, letters);
    mount(
      body,
      h(
        'div',
        { class: 'wotd__word' },
        h('div', { class: 'wotd__bg', lang: 'bg', 'data-testid': 'wotd-bg' }, word.bg),
        speakButton(word.bg, voice),
      ),
      h('p', { class: 'wotd__latin', 'data-testid': 'wotd-latin' }, word.latin),
      word.say ? h('p', { class: 'wotd__say', 'data-testid': 'wotd-say' }, 'Say: ', h('strong', {}, word.say), h('span', { class: 'muted' }, '  (capitals = stress)')) : null,
      hints.length ? h('ul', { class: 'wotd__hints muted', 'data-testid': 'wotd-hints' }, hints.map((x) => h('li', {}, x))) : null,
      show
        ? [
            h('p', { class: 'wotd__en', 'data-testid': 'wotd-en' }, word.en),
            word.note ? h('p', { class: 'muted wotd__note' }, word.note) : null,
          ]
        : h('button', { type: 'button', class: 'btn btn--primary wotd__reveal', 'data-testid': 'wotd-reveal', onclick: () => draw(got, true) }, 'What does it mean?'),
      show && !done
        ? h(
            'div',
            { class: 'row wotd__answer' },
            h('button', { type: 'button', class: 'btn', disabled: ctx.readOnly, 'data-testid': 'wotd-knew', onclick: () => answer(word, true) }, '✓ I knew it'),
            h('button', { type: 'button', class: 'btn', disabled: ctx.readOnly, 'data-testid': 'wotd-notyet', onclick: () => answer(word, false) }, 'Not yet'),
          )
        : null,
      done
        ? h('p', { class: 'wotd__done', 'data-testid': 'wotd-done' }, done.knew ? '✓ You knew it. A new word tomorrow.' : 'Added to your Bulgarian cards: the review brings it back.')
        : null,
    );
  };

  const now0 = getWord();
  if (now0) draw(now0);
  else {
    mount(body, h('p', { class: 'muted' }, 'Loading…'));
    Promise.resolve()
      .then(load)
      .then((got) => {
        if (got) draw(got);
        else node.remove();
      })
      .catch(() => node.remove());
  }
  return node;
}
