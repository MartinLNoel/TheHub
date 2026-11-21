// The word of the day (0.9.14): every reading word's pronunciation matches its Latin form, the schema 1 → 2
// migration, answering ("I knew it" / "Not yet" making a card), the sound hints, and the quiz card under "Today".
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bulgarian, { todayWidget } from '../../src/modules/bulgarian/index.js';
import { SCHEMA_VERSION, WORD_OF_DAY_TOPIC, answerWordOfDay, migrations, wordOfDayAnswer } from '../../src/modules/bulgarian/data.js';
import { checkTrainer, sayProblems, setTrainer } from '../../src/modules/bulgarian/content.js';
import { soundHints, wordOfDayWidget } from '../../src/modules/bulgarian/word-of-day.js';
import { renderToday } from '../../src/core/today.js';
import { createRegistry } from '../../src/core/registry.js';

const DIR = join(import.meta.dirname, '..', '..', 'content', 'bulgarian');
const readJSON = (name) => JSON.parse(readFileSync(join(DIR, name), 'utf8'));
const ALPHABET = readJSON('alphabet.json');
const READING = readJSON('reading.json');
const LETTERS = ALPHABET.letters;
const NOON = new Date(2026, 10, 21, 12);
const fresh = () => bulgarian.defaultData();
const word = (id) => READING.find((w) => w.id === id);
const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('pronunciation ("say")', () => {
  it('every reading word has one, and it spells its Latin form with one stress per word', () => {
    for (const w of READING) {
      expect(w.say, w.id).toBeTruthy();
      expect(sayProblems(w.say, w.latin), w.id).toEqual([]);
    }
    expect(checkTrainer(ALPHABET, READING).problems).toEqual([]);
  });

  it('catches a pronunciation that does not match, has two stresses, or none', () => {
    expect(sayProblems('zdra-VEJ', 'zdravey')).toEqual(['say "zdra-VEJ" does not spell the Latin form "zdravey"']);
    expect(sayProblems('ZDRA-VEY', 'zdravey')).toEqual(['say "ZDRA-VEY" stresses two syllables in one word']);
    expect(sayProblems('zdra-vey', 'zdravey')).toEqual(['say "zdra-vey" has no stressed syllable']);
    expect(sayProblems('zdra--VEY', 'zdravey')).toContain('say "zdra--VEY" has an empty syllable');
    expect(sayProblems('KAK si', 'kak si')).toEqual([]); // a little word may lean on the one before
    expect(sayProblems('KĂSH-ta', 'kăshta')).toEqual([]);
  });
});

describe('data (schema 2)', () => {
  it('migrates version 1 data: no answer yet, and the result is valid', () => {
    expect(SCHEMA_VERSION).toBe(2);
    const v1 = { ...fresh() };
    delete v1.wordOfDay;
    const v2 = migrations[2](v1);
    expect(v2.wordOfDay).toBeNull();
    expect(bulgarian.validate(v2)).toEqual([]);
    expect(bulgarian.migrations[2]).toBe(migrations[2]);
  });

  it('"I knew it": kept for today, counted as practice, no card', () => {
    const d = answerWordOfDay(fresh(), word('r-voda'), true, { now: NOON });
    expect(d.wordOfDay).toEqual({ date: '2026-11-21', id: 'r-voda', knew: true });
    expect(d.reading['r-voda']).toEqual({ right: 1, wrong: 0, streak: 1 });
    expect(d.activity).toContain('2026-11-21');
    expect(d.homeDeck).toEqual([]);
    expect(bulgarian.validate(d)).toEqual([]);
    expect(wordOfDayAnswer(d, 'r-voda', '2026-11-21')).toMatchObject({ knew: true });
    expect(wordOfDayAnswer(d, 'r-voda', '2026-11-22')).toBeNull();
  });

  it('"Not yet": becomes a two-way card once, filed under the word of the day', () => {
    let d = answerWordOfDay(fresh(), word('r-voda'), false, { now: NOON });
    expect(d.homeDeck).toHaveLength(1);
    expect(d.homeDeck[0]).toMatchObject({ front: 'вода', back: 'water', topic: WORD_OF_DAY_TOPIC, twoWay: true });
    expect(d.reading['r-voda'].wrong).toBe(1);
    d = answerWordOfDay(d, word('r-voda'), false, { now: new Date(2026, 11, 30, 12) });
    expect(d.homeDeck).toHaveLength(1);
    expect(bulgarian.validate(d)).toEqual([]);
  });

  it('validate rejects a broken answer', () => {
    expect(bulgarian.validate({ ...fresh(), wordOfDay: { date: 'today', id: 'x', knew: true } })).toContain('wordOfDay must be empty or { date, id, knew }');
  });
});

describe('sound hints', () => {
  it('the letters an English speaker cannot guess, once each, in word order', () => {
    expect(soundHints(word('r-kashta'), LETTERS)).toEqual(['ъ = ă, as the "a" in "sofa"', 'щ = sht, as in "ashtray"']);
    expect(soundHints(word('r-blagodarya'), LETTERS)).toEqual(['р = r, rolled']);
    expect(soundHints(word('r-mama'), LETTERS)).toEqual([]);
  });
});

describe('the card under "Today"', () => {
  const setup = (data = fresh(), { save, readOnly = false } = {}) => {
    const saved = [];
    const ctx = { data, readOnly, save: save || (async (d) => saved.push(d)) };
    const got = { word: word('r-kashta'), letters: LETTERS };
    const node = wordOfDayWidget(ctx, { getWord: () => got, load: async () => got, now: () => NOON });
    document.body.replaceChildren(node);
    return { node, saved, q: (id) => node.querySelector(`[data-testid="${id}"]`) };
  };

  it('Bulgarian, Latin, pronunciation and hints first; the meaning only after a tap; then the answer', async () => {
    const { q, saved } = setup();
    expect(q('wotd-bg').textContent).toBe('къща');
    expect(q('wotd-latin').textContent).toBe('kăshta');
    expect(q('wotd-say').textContent).toContain('KĂSH-ta');
    expect(q('wotd-hints').textContent).toContain('sofa');
    expect(q('wotd-en')).toBeNull();
    expect(q('wotd-knew')).toBeNull();
    q('wotd-reveal').click();
    expect(q('wotd-en').textContent).toBe('house');
    q('wotd-notyet').click();
    await flush();
    expect(saved.at(-1).homeDeck[0].front).toBe('къща');
    expect(q('wotd-done').textContent).toContain('Added to your Bulgarian cards');
    expect(q('wotd-knew')).toBeNull();
  });

  it('answered today: shows the meaning and the answer straight away', () => {
    const data = answerWordOfDay(fresh(), word('r-kashta'), true, { now: NOON });
    const { q } = setup(data);
    expect(q('wotd-en').textContent).toBe('house');
    expect(q('wotd-done').textContent).toContain('You knew it');
    expect(q('wotd-reveal')).toBeNull();
  });

  it('a failed save shows why and keeps the answer buttons', async () => {
    const { q } = setup(fresh(), {
      save: async () => {
        throw new Error('disk full');
      },
    });
    q('wotd-reveal').click();
    q('wotd-knew').click();
    await flush();
    expect(q('wotd-msg').textContent).toContain('disk full');
    expect(q('wotd-knew')).not.toBeNull();
  });

  it('read-only data cannot answer', () => {
    const { q } = setup(fresh(), { readOnly: true });
    q('wotd-reveal').click();
    expect(q('wotd-knew').disabled).toBe(true);
  });

  it('the module puts it under "Today" once the words are loaded, and saves the Bulgarian data', async () => {
    setTrainer(ALPHABET, READING);
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const saves = [];
    renderToday(root, { registry: createRegistry([bulgarian]), state: { bulgarian: { data: fresh(), readOnly: false } }, saveFor: (mod) => async (d) => saves.push(mod.id) });
    const card = root.querySelector('[data-testid="wotd"]');
    expect(card).not.toBeNull();
    expect(READING.map((w) => w.bg)).toContain(card.querySelector('[data-testid="wotd-bg"]').textContent);
    card.querySelector('[data-testid="wotd-reveal"]').click();
    card.querySelector('[data-testid="wotd-knew"]').click();
    await flush();
    expect(saves).toEqual(['bulgarian']);
    expect(typeof todayWidget).toBe('function');
  });
});
