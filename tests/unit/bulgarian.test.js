// The Bulgarian module (Part 7, before the book): the alphabet and reading content, Cyrillic through
// backup and export, two-way cards, accept (hub.offer) and the 🔊 button.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bulgarian, { todayCard } from '../../src/modules/bulgarian/index.js';
import {
  LEARNED_STREAK, acceptOffer, buildRound, letterLearned, markActivity, recordAnswer, removeHomeCard, streak, transliterate, validateExtra,
  wordKey, wordsLearned,
} from '../../src/modules/bulgarian/data.js';
import { checkTrainer, letterProblems, setTrainer, wordProblems } from '../../src/modules/bulgarian/content.js';
import { feedbackTitle } from '../../src/modules/bulgarian/screens.js';
import { dueSides, gradeSide } from '../../src/core/study/scheduler.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';
import { createHub } from '../../src/core/hub.js';
import { openStorage } from '../../src/core/db.js';
import { applyImport, buildBackup, canonicalJSON, exportAll, readImport, sha256Hex, verifyBackup } from '../../src/core/transfer.js';
import { fromBase64, toBase64 } from '../../src/core/github.js';
import { createBackupService } from '../../src/core/backup.js';
import { findVoice, speakButton, voiceLine, whenVoice } from '../../src/core/speech.js';
import { diagnosticsCard } from '../../src/core/diagnostics.js';
import { TEST_TOKEN, createFakeGitHub } from '../fixtures/fake-github.js';

const ROOT = join(import.meta.dirname, '..', '..');
const DIR = join(ROOT, 'content', 'bulgarian');
const readJSON = (name) => JSON.parse(readFileSync(join(DIR, name), 'utf8'));
const ALPHABET = readJSON('alphabet.json');
const READING = readJSON('reading.json');
const MANIFEST = readJSON('index.json');
const LETTERS = ALPHABET.letters;
const flush = () => new Promise((r) => setTimeout(r, 0));

/** The 30 Bulgarian capitals by code point: А (U+0410) to Я (U+042F), without Ы (U+042B) and Э (U+042D). */
const BG_UPPER = Array.from({ length: 32 }, (_, i) => String.fromCodePoint(0x410 + i)).filter((c) => c !== 'Ы' && c !== 'Э');

const fresh = (extra = {}) => ({ ...bulgarian.defaultData(), ...extra });

// The module's screens fetch content/ like the app does: serve it from disk.
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname.replace(/^\//, '');
    try {
      return new Response(readFileSync(join(ROOT, path), 'utf8'), { status: 200 });
    } catch {
      return new Response('', { status: 404 });
    }
  };
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

// ---------- content ----------

describe('content/bulgarian: the alphabet', () => {
  it('has exactly the 30 Bulgarian letters, in order, as real Cyrillic code points', () => {
    expect(LETTERS).toHaveLength(30);
    expect(LETTERS.map((l) => l.upper)).toEqual(BG_UPPER);
    expect(LETTERS.map((l) => l.lower)).toEqual(BG_UPPER.map((c) => String.fromCodePoint(c.codePointAt(0) + 0x20)));
    for (const l of LETTERS) {
      expect(l.upper.codePointAt(0), l.id).toBeGreaterThanOrEqual(0x410);
      expect(l.upper.codePointAt(0), l.id).toBeLessThanOrEqual(0x42f);
    }
  });

  it('passes the trainer check with no problems (letters and reading words)', () => {
    expect(checkTrainer(ALPHABET, READING).problems).toEqual([]);
  });

  it('spells the sounds the learner traps need, with a note for Russian readers', () => {
    const by = Object.fromEntries(LETTERS.map((l) => [l.upper, l]));
    expect(by['Щ'].latin).toBe('sht');
    expect(by['Щ'].russian).toMatch(/sht/);
    expect(by['Ъ'].russian).toMatch(/vowel/);
    expect(by['Ъ'].latin).toBe('ă');
    expect(by['Ь'].russian).toMatch(/only before О/);
    expect(by['Ь'].example.bg).toContain('ьо');
    expect(by['Е'].russian).toMatch(/ye/);
    expect(by['О'].russian).toBeTruthy();
    expect(ALPHABET.notes.join(' ')).toMatch(/no Ё, Ы or Э/);
    // Every letter appears in its own example word.
    for (const l of LETTERS) expect(l.example.bg.toLocaleLowerCase('bg'), l.id).toContain(l.lower);
  });

  it("every example word's Latin form is what its letters spell", () => {
    for (const l of LETTERS) expect(transliterate(l.example.bg, LETTERS), l.id).toBe(l.example.latin);
  });

  it('the sounds are all different (so a sound → letter question has one answer)', () => {
    expect(new Set(LETTERS.map((l) => l.sound)).size).toBe(30);
  });
});

describe('content/bulgarian: reading words', () => {
  it('are short, everyday, unique, and spelt only with Bulgarian letters', () => {
    expect(READING.length).toBeGreaterThanOrEqual(30);
    expect(new Set(READING.map((w) => w.id)).size).toBe(READING.length);
    expect(new Set(READING.map((w) => wordKey(w.bg))).size).toBe(READING.length);
    for (const w of READING) {
      expect(wordProblems(w, LETTERS), w.id).toEqual([]);
      expect(w.bg.split(' ').length, w.id).toBeLessThanOrEqual(2);
    }
  });

  it('numbers one to ten are all there', () => {
    const nums = READING.filter((w) => w.topic === 'numbers').map((w) => w.bg);
    expect(nums).toEqual(['едно', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет', 'десет']);
  });
});

describe('content/bulgarian: the manifest is ready for book chapters', () => {
  it('lists empty chapters, lessons, questions and cards, and names the trainer files', () => {
    expect(MANIFEST.chapters).toEqual([]);
    for (const k of ['lessons', 'questions', 'cards']) expect(MANIFEST[k]).toEqual([]);
    expect(MANIFEST.alphabet).toBe('alphabet.json');
    expect(MANIFEST.reading).toBe('reading.json');
  });

  it('every content file is precached', () => {
    const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
    for (const f of ['index.json', 'alphabet.json', 'reading.json', 'handled-feedback.json']) expect(sw).toContain(`'content/bulgarian/${f}'`);
  });
});

describe('the trainer check rejects bad content', () => {
  const good = LETTERS[0];
  it.each([
    ['a Latin look-alike', { upper: 'A' }, /upper must be one Cyrillic/],
    ['two letters', { lower: 'аа' }, /lower must be one/],
    ['wrong lower case', { lower: 'б' }, /lower case of upper/],
    ['no sound', { sound: '' }, /sound is required/],
    ['no example', { example: { bg: 'аз' } }, /example/],
    ['bad id', { id: 'А' }, /id/],
  ])('letter: %s', (_n, change, pattern) => {
    expect(letterProblems({ ...good, ...change }).join('\n')).toMatch(pattern);
  });

  it('reading: a Latin form that does not match the letters, or a non-Bulgarian letter', () => {
    expect(wordProblems({ id: 'x', bg: 'вода', latin: 'woda', en: 'water', topic: 't' }, LETTERS).join()).toMatch(/spell "voda"/);
    expect(wordProblems({ id: 'x', bg: 'выход', latin: 'x', en: 'exit', topic: 't' }, LETTERS).join()).toMatch(/not Bulgarian letters: ы/);
  });

  it('duplicates are dropped and reported', () => {
    const { problems, alphabet } = checkTrainer({ notes: [], letters: [good, good] }, []);
    expect(alphabet.letters).toHaveLength(1);
    expect(problems.join()).toMatch(/used twice/);
  });
});

describe('transliterate', () => {
  it('goes letter by letter and keeps capitals and spaces', () => {
    expect(transliterate('България', LETTERS)).toBe('Bălgariya');
    expect(transliterate('Щастие и шофьор', LETTERS)).toBe('Shtastie i shofyor');
    expect(transliterate('как си?', LETTERS)).toBe('kak si?');
  });
});

// ---------- the module ----------

describe('the module', () => {
  it('follows the module contract, accepts offers and validates its default data', () => {
    expect(checkModule(bulgarian)).toEqual([]);
    expect(typeof bulgarian.accept).toBe('function');
    expect(bulgarian.validate(bulgarian.defaultData())).toEqual([]);
    expect(Object.keys(bulgarian.routes)).toEqual(expect.arrayContaining(['', 'alphabet', 'practice/*', 'cards', 'feedback']));
  });

  it('validate rejects broken Bulgarian fields', () => {
    expect(validateExtra({ ...fresh(), activity: ['yesterday'] }).join()).toMatch(/activity/);
    expect(validateExtra({ ...fresh(), alphabet: { a: { toSound: { right: -1, wrong: 0, streak: 0 } } } }).join()).toMatch(/alphabet.a.toSound/);
    expect(validateExtra({ ...fresh(), homeDeck: [{ id: 'home-1' }] }).join()).toMatch(/homeDeck\[0\]/);
    expect(validateExtra({ ...fresh(), reading: [] }).join()).toMatch(/reading/);
  });
});

// ---------- accept (hub.offer) ----------

describe('accept: the "From my home" deck', () => {
  const now = new Date(2026, 9, 18, 9, 0);

  it('adds a two-way bg ↔ en card', () => {
    const next = acceptOffer({ bg: '  мляко ', en: 'Milk', topic: 'food' }, fresh(), { now });
    expect(next.homeDeck).toEqual([
      { id: 'home-1', front: 'мляко', back: 'Milk', topic: 'food', twoWay: true, lang: { front: 'bg', back: 'en' }, deck: 'home', added: '2026-10-18' },
    ]);
    expect(bulgarian.validate(next)).toEqual([]);
    const second = acceptOffer({ bg: 'Прясно мляко', en: 'Fresh milk', topic: 'food' }, next, { now });
    expect(second.homeDeck.map((c) => c.id)).toEqual(['home-1', 'home-2']);
  });

  it('returns null for a duplicate, whatever its case, spacing or Unicode form', () => {
    const data = acceptOffer({ bg: 'Сирене', en: 'Cheese', topic: 'food' }, fresh(), { now });
    expect(acceptOffer({ bg: 'сирене', en: 'White cheese', topic: 'food' }, data)).toBeNull();
    expect(acceptOffer({ bg: '  СИРЕНЕ  ', en: 'x', topic: 'food' }, data)).toBeNull();
    // й written as и + combining breve is the same word.
    const chay = acceptOffer({ bg: 'чай', en: 'Tea', topic: 'food' }, fresh(), { now });
    expect(acceptOffer({ bg: 'чай', en: 'Tea', topic: 'food' }, chay)).toBeNull();
  });

  it('returns null for a word the course already has as a card', () => {
    const contentCards = [{ id: 'ch1-voda', front: 'вода', back: 'water', topic: 'ch1', twoWay: true, lang: { front: 'bg', back: 'en' } }];
    expect(acceptOffer({ bg: 'Вода', en: 'Water', topic: 'food' }, fresh(), { contentCards })).toBeNull();
  });

  it('returns null for something that is not a Bulgarian word with a meaning', () => {
    expect(acceptOffer({ bg: 'milk', en: 'Milk', topic: 'food' }, fresh())).toBeNull();
    expect(acceptOffer({ bg: 'мляко', en: ' ', topic: 'food' }, fresh())).toBeNull();
    expect(acceptOffer({ bg: '', en: 'Milk' }, fresh())).toBeNull();
    expect(acceptOffer(null, fresh())).toBeNull();
    expect(acceptOffer({ bg: 'я'.repeat(81), en: 'x' }, fresh())).toBeNull();
  });

  it('through hub.offer: accepted, saved, then declined as a duplicate', async () => {
    const state = { bulgarian: { data: fresh() } };
    const save = vi.fn(async () => {});
    const hub = createHub({ registry: createRegistry([bulgarian]), state, save });
    expect(hub.accepts('bulgarian')).toBe(true);
    expect(await hub.offer('bulgarian', { bg: 'мляко', en: 'Milk', topic: 'food' })).toEqual({ accepted: true });
    expect(save).toHaveBeenCalledTimes(1);
    expect(state.bulgarian.data.homeDeck.map((c) => c.front)).toEqual(['мляко']);
    expect(await hub.offer('bulgarian', { bg: 'Мляко', en: 'Milk', topic: 'food' })).toEqual({ accepted: false, reason: 'declined' });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('removing a home card also forgets the schedule of both its sides', () => {
    let d = acceptOffer({ bg: 'мляко', en: 'Milk', topic: 'food' }, fresh(), { now });
    d = { ...d, cardState: gradeSide(gradeSide({}, 'home-1', 'good', '2026-10-18'), 'home-1~rev', 'good', '2026-10-18') };
    const out = removeHomeCard(d, 'home-1');
    expect(out.homeDeck).toEqual([]);
    expect(out.cardState).toEqual({});
  });
});

// ---------- two-way cards ----------

describe('two-way cards schedule each direction separately', () => {
  const today = '2026-10-18';
  const data = acceptOffer({ bg: 'хляб', en: 'Bread', topic: 'food' }, fresh(), { now: new Date(2026, 9, 18) });
  const cards = data.homeDeck;

  it('a new card gives two sides to review: bg → en and en → bg', () => {
    expect(dueSides(cards, {}, today).map((s) => [s.key, s.reverse])).toEqual([
      ['home-1', false],
      ['home-1~rev', true],
    ]);
  });

  it('grading one direction leaves the other one due, with its own state', () => {
    const state = gradeSide({}, 'home-1', 'good', today);
    expect(state['home-1'].due).toBe('2026-10-19');
    expect(state['home-1~rev']).toBeUndefined();
    expect(dueSides(cards, state, today).map((s) => s.key)).toEqual(['home-1~rev']);
    const both = gradeSide(state, 'home-1~rev', 'again', today);
    expect(both['home-1~rev']).toMatchObject({ due: today, lapses: 1 });
    expect(both['home-1']).toEqual(state['home-1']);
    expect(dueSides(cards, both, '2026-10-19').map((s) => s.key)).toEqual(['home-1~rev', 'home-1']);
  });

  it('a word counts as learned only when both directions were last answered right', () => {
    const one = gradeSide({}, 'home-1', 'good', today);
    expect(wordsLearned(cards, one)).toBe(0);
    expect(wordsLearned(cards, gradeSide(one, 'home-1~rev', 'hard', today))).toBe(1);
  });
});

// ---------- alphabet practice, streak, Today ----------

describe('alphabet practice', () => {
  it('a letter is learned after LEARNED_STREAK right answers in a row, both ways; a miss resets', () => {
    let d = fresh();
    for (let i = 0; i < LEARNED_STREAK; i++) d = recordAnswer(d, 'to-sound', 'sht', true, '2026-10-18');
    expect(letterLearned(d, 'sht')).toBe(false);
    for (let i = 0; i < LEARNED_STREAK; i++) d = recordAnswer(d, 'to-letter', 'sht', true, '2026-10-18');
    expect(letterLearned(d, 'sht')).toBe(true);
    d = recordAnswer(d, 'to-letter', 'sht', false, '2026-10-18');
    expect(letterLearned(d, 'sht')).toBe(false);
    expect(d.alphabet.sht).toEqual({ toSound: { right: 2, wrong: 0, streak: 2 }, toLetter: { right: 2, wrong: 1, streak: 0 } });
    expect(bulgarian.validate(d)).toEqual([]);
  });

  it('a round: 10 questions, 4 different options with the answer among them, letters not yet known first', () => {
    let d = fresh();
    const known = LETTERS.slice(0, 20).map((l) => l.id);
    for (const id of known) for (let i = 0; i < 3; i++) d = recordAnswer(d, 'to-sound', id, true, '2026-10-18');
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const round = buildRound('to-sound', { letters: LETTERS, words: READING }, d, rng);
    expect(round).toHaveLength(10);
    for (const q of round) {
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.id);
      expect(known).not.toContain(q.id);
    }
    const reading = buildRound('reading', { letters: LETTERS, words: READING }, fresh(), rng);
    expect(reading).toHaveLength(10);
    for (const q of reading) {
      const latins = q.options.map((id) => READING.find((w) => w.id === id).latin);
      expect(new Set(latins).size).toBe(4);
    }
  });

  it('records reading answers and marks the day', () => {
    const d = recordAnswer(fresh(), 'reading', 'r-voda', false, '2026-10-18');
    expect(d.reading['r-voda']).toEqual({ right: 0, wrong: 1, streak: 0 });
    expect(d.activity).toEqual(['2026-10-18']);
    expect(() => recordAnswer(fresh(), 'nope', 'a', true)).toThrow(/unknown practice mode/);
  });
});

describe('streak', () => {
  it('counts days in a row up to today, or up to yesterday while today is still open', () => {
    let d = fresh();
    for (const day of ['2026-10-14', '2026-10-16', '2026-10-17']) d = markActivity(d, day);
    expect(streak(d, '2026-10-18')).toBe(2);
    expect(streak(markActivity(d, '2026-10-18'), '2026-10-18')).toBe(3);
    expect(streak(d, '2026-10-19')).toBe(0);
    expect(markActivity(d, '2026-10-17')).toBe(d);
  });
});

describe('Today card', () => {
  it('shows cards due, alphabet progress and the streak, and points at the next thing to do', () => {
    const now = new Date(2026, 9, 18, 12);
    expect(todayCard(fresh(), null, LETTERS, now)).toEqual({
      title: 'Bulgarian',
      lines: ['Cards due: 0', 'Alphabet: 0/30 letters learned'],
      action: { label: 'Practise letters', route: 'bulgarian/alphabet' },
    });
    let d = acceptOffer({ bg: 'мляко', en: 'Milk', topic: 'food' }, fresh(), { now });
    d = recordAnswer(d, 'to-sound', 'a', true, '2026-10-18');
    const card = todayCard(d, { cards: [] }, LETTERS, now);
    expect(card.lines).toEqual(['Cards due: 2', 'Alphabet: 0/30 letters learned', 'Streak: 1 day']);
    expect(card.action).toEqual({ label: 'Review cards', route: 'bulgarian/cards' });
    expect(todayCard(null, null)).toBeNull();
  });
});

describe('feedback titles', () => {
  it('name the letter or the word', () => {
    setTrainer(ALPHABET, READING);
    const tr = checkTrainer(ALPHABET, READING);
    expect(feedbackTitle({ targetKind: 'letter', targetId: 'letter-sht' }, tr)).toBe('Letter Щ щ');
    expect(feedbackTitle({ targetKind: 'word', targetId: 'word-r-voda' }, tr)).toBe('Reading word вода');
    expect(feedbackTitle({ targetKind: 'card', targetId: 'home-1' }, tr)).toBeNull();
  });
});

// ---------- Cyrillic through backup and export ----------

const CYRILLIC_DATA = () => {
  let d = fresh();
  const words = [
    ['Прясно мляко', 'Fresh milk'],
    ['щастие', 'happiness'],
    ['шофьор', 'driver'],
    ['ябълка', 'apple'],
    ['чай', 'tea'],
    ['Юни, ЪГЪЛ', 'June, corner'],
  ];
  for (const [bg, en] of words) d = acceptOffer({ bg, en, topic: 'food' }, d, { now: new Date(2026, 9, 18) });
  d = { ...d, feedback: [{ id: 'f1', targetId: 'letter-schwa', targetKind: 'letter', text: 'Ъ звучи като „а“ в sofa? 🤔', at: '2026-10-18T08:00:00.000Z', resolved: false }] };
  return recordAnswer(d, 'to-sound', 'schwa', true, '2026-10-18');
};

let n = 0;
const dbName = () => `thehub-bg-${++n}-${Math.random().toString(36).slice(2)}`;

describe('Cyrillic round-trips unchanged through export, import and backup', () => {
  it('renders unchanged in the home deck list', async () => {
    const data = CYRILLIC_DATA();
    setTrainer(ALPHABET, READING);
    const root = document.createElement('div');
    document.body.append(root);
    await bulgarian.routes['']({ root, data, readOnly: false, save: async () => {}, navigate: () => {}, settings: {}, params: '' });
    expect(root.querySelector('[data-testid="bg-book-panel"]').textContent).toMatch(/Lessons start when your course book is added/);
    const words = [...root.querySelectorAll('[data-testid="bg-home-word"] strong')].map((e) => e.textContent);
    expect(words).toEqual(data.homeDeck.map((c) => c.front));
    expect(root.querySelector('[data-testid="bg-home-word"] strong').getAttribute('lang')).toBe('bg');
    root.remove();
  });

  it('export → file text → import into an empty app gives byte-identical data and the same checksum', async () => {
    const data = CYRILLIC_DATA();
    const registry = createRegistry([bulgarian]);
    const a = await openStorage({ dbName: dbName(), modules: registry.list() });
    await a.load(bulgarian);
    await a.save(bulgarian, data);
    const exported = await exportAll(a, registry, '0.8.1');
    const text = JSON.stringify(exported, null, 2);
    expect(text).toContain('Прясно мляко');
    expect(text).not.toMatch(/\\u04/); // stored as real characters, not escapes
    expect(await sha256Hex(canonicalJSON(JSON.parse(text).modules))).toBe(exported.sha256);

    const b = await openStorage({ dbName: dbName(), modules: registry.list() });
    await b.load(bulgarian);
    const verified = await readImport(text, registry);
    expect(verified.problems).toEqual([]);
    await applyImport(b, verified);
    const back = (await b.load(bulgarian)).data;
    expect(back).toEqual(data);
    expect(canonicalJSON(back)).toBe(canonicalJSON(data));
    const again = await exportAll(b, registry, '0.8.1');
    expect(again.sha256).toBe(exported.sha256);
    a.close();
    b.close();
  });

  it('a tampered Cyrillic letter breaks the checksum', async () => {
    const registry = createRegistry([bulgarian]);
    const file = await buildBackup({ modules: { bulgarian: { schemaVersion: 1, data: CYRILLIC_DATA() } }, appVersion: 'x' });
    expect((await verifyBackup(file, registry)).ok).toBe(true);
    const tampered = structuredClone(file);
    tampered.modules.bulgarian.data.homeDeck[1].front = 'щастиe'; // the last letter is a Latin e
    expect((await verifyBackup(tampered, registry)).problems.join()).toMatch(/Checksum mismatch/);
  });

  it('the GitHub backup (base64 of UTF-8) uploads, reads back and verifies with the same Cyrillic', async () => {
    const data = CYRILLIC_DATA();
    expect(fromBase64(toBase64(JSON.stringify(data)))).toBe(JSON.stringify(data));
    const registry = createRegistry([bulgarian]);
    const storage = await openStorage({ dbName: dbName(), modules: registry.list() });
    await storage.load(bulgarian);
    await storage.save(bulgarian, data);
    const fake = createFakeGitHub();
    const service = createBackupService({ storage, registry, appVersion: '0.8.1', fetch: fake.fetch, now: () => Date.parse('2026-10-18T08:00:00Z') });
    await service.setToken(TEST_TOKEN);
    const r = await service.backupNow();
    expect(r.ok).toBe(true);
    const stored = JSON.parse(fake.latest().text);
    expect(stored.modules.bulgarian.data).toEqual(data);
    expect((await verifyBackup(stored, registry)).ok).toBe(true);
    storage.close();
  });
});

// ---------- speech: the 🔊 button ----------

function fakeSynth(voices = [], { late = false } = {}) {
  let list = late ? [] : voices;
  const listeners = new Set();
  return {
    spoken: [],
    getVoices: () => list,
    addEventListener: (type, fn) => type === 'voiceschanged' && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
    cancel: vi.fn(),
    speak(u) {
      this.spoken.push(u);
    },
    arrive() {
      list = voices;
      for (const fn of [...listeners]) fn();
    },
  };
}
class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}
const BG = { name: 'Google български', lang: 'bg-BG', localService: true };
const EN = { name: 'Google US English', lang: 'en-US', localService: true };

describe('the 🔊 button (speechSynthesis, bg-BG only)', () => {
  it('findVoice takes only a Bulgarian voice', () => {
    expect(findVoice('bg-BG', fakeSynth([EN]))).toBeNull();
    expect(findVoice('bg-BG', fakeSynth([EN, BG]))).toBe(BG);
    expect(findVoice('bg-BG', fakeSynth([{ name: 'x', lang: 'bg_BG' }]))?.name).toBe('x');
    expect(findVoice('bg-BG', undefined)).toBeNull();
  });

  it('is hidden without speechSynthesis, and with only non-Bulgarian voices', async () => {
    const none = speakButton('вода', 'bg-BG', { synth: undefined });
    const english = speakButton('вода', 'bg-BG', { synth: fakeSynth([EN]), waitMs: 10 });
    await new Promise((r) => setTimeout(r, 30));
    expect(none.hidden).toBe(true);
    expect(english.hidden).toBe(true);
  });

  it('is shown with a (mocked) bg-BG voice and speaks with it', async () => {
    const synth = fakeSynth([EN, BG]);
    const btn = speakButton('вода', 'bg-BG', { synth, Utterance: FakeUtterance });
    expect(btn.hidden).toBe(true);
    await flush();
    expect(btn.hidden).toBe(false);
    btn.click();
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]).toMatchObject({ text: 'вода', voice: BG, lang: 'bg-BG' });
  });

  it('appears when the voice list arrives late (Chrome)', async () => {
    const synth = fakeSynth([BG], { late: true });
    const btn = speakButton('чай', 'bg-BG', { synth, waitMs: 1000 });
    await flush();
    expect(btn.hidden).toBe(true);
    synth.arrive();
    await flush();
    expect(btn.hidden).toBe(false);
    expect(await whenVoice('bg-BG', fakeSynth([EN]), 5)).toBeNull();
  });

  describe('on the flashcards screen (engine cardExtras)', () => {
    const saved = globalThis.speechSynthesis;
    afterEach(() => {
      globalThis.speechSynthesis = saved;
      document.body.replaceChildren();
    });

    async function showCard(synth) {
      globalThis.speechSynthesis = synth;
      const data = acceptOffer({ bg: 'мляко', en: 'Milk', topic: 'food' }, fresh());
      const root = document.createElement('div');
      document.body.append(root);
      await bulgarian.routes.cards({ root, data, readOnly: false, save: async () => {}, navigate: () => {}, settings: {}, params: '' });
      await new Promise((r) => setTimeout(r, 30));
      return root;
    }

    it('hidden without a bg-BG voice', async () => {
      const root = await showCard(fakeSynth([EN]));
      expect(root.querySelector('[data-testid="card-front"]').textContent).toBe('мляко');
      expect(root.querySelector('[data-testid="card-front"]').getAttribute('lang')).toBe('bg');
      const speak = root.querySelector('[data-testid="flashcard"] [data-testid="speak"]');
      expect(speak).not.toBeNull();
      await new Promise((r) => setTimeout(r, 2100));
      expect(speak.hidden).toBe(true);
    }, 5000);

    it('shown with a mocked bg-BG voice; the English side gets none', async () => {
      const root = await showCard(fakeSynth([BG]));
      const speak = root.querySelectorAll('[data-testid="flashcard"] [data-testid="speak"]');
      expect(speak).toHaveLength(1);
      expect(speak[0].hidden).toBe(false);
      root.querySelector('[data-testid="card-show"]').click();
      expect(root.querySelectorAll('[data-testid="flashcard"] [data-testid="speak"]')).toHaveLength(1); // back = English
    });

    it('grading a card marks the day for the streak', async () => {
      const saves = [];
      globalThis.speechSynthesis = fakeSynth([]);
      const data = acceptOffer({ bg: 'мляко', en: 'Milk', topic: 'food' }, fresh());
      const root = document.createElement('div');
      document.body.append(root);
      await bulgarian.routes.cards({ root, data, readOnly: false, save: async (d) => saves.push(d), navigate: () => {}, settings: {}, params: '' });
      root.querySelector('[data-testid="card-show"]').click();
      root.querySelector('[data-testid="grade-good"]').click();
      await flush();
      expect(saves).toHaveLength(1);
      expect(Object.keys(saves[0].cardState)).toEqual(['home-1']);
      expect(saves[0].activity).toHaveLength(1);
    });
  });

  it('Settings → Diagnostics says whether a bg-BG voice exists', async () => {
    expect(await voiceLine('bg-BG', undefined)).toMatch(/speech is not available/);
    expect(await voiceLine('bg-BG', fakeSynth([EN]), 5)).toBe('Speech voice bg-BG: not available (the 🔊 buttons stay hidden).');
    expect(await voiceLine('bg-BG', fakeSynth([BG]))).toBe('Speech voice bg-BG: available (Google български, bg-BG).');
    const card = diagnosticsCard({ speechSynthesis: fakeSynth([BG]), navigator: {} });
    await flush();
    await flush();
    expect(card.querySelector('[data-testid="diag-voice-bg"]').textContent).toMatch(/available \(Google български/);
  });
});
