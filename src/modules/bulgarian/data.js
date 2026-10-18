// The Bulgarian module's own data and rules (pure functions, unit-tested). The study engine's progress
// (docs/plans/part-0-overview.md, "Study engine data") plus, schema version 1:
//
//   alphabet   { [letterId]: { toSound?: Stat, toLetter?: Stat } }   letter → sound and sound → letter practice
//   reading    { [wordId]: Stat }                                     reading practice (content/bulgarian/reading.json)
//   activity   ["YYYY-MM-DD"]   local days with any practice or card review (the streak), oldest first
//   homeDeck   [card]           the "From my home" deck: words other modules offered (the Fridge, through
//                               hub.offer), each a two-way card { id: "home-<n>", front: bg, back: en, topic,
//                               twoWay: true, lang: { front: "bg", back: "en" }, deck: "home", added }
//   Stat = { right, wrong, streak }   streak = right answers in a row
//
// Cards (from the book later, and the home deck now) are scheduled by the engine, each direction on its own
// (keys "<id>" and "<id>~rev", src/core/study/scheduler.js).
import { cardProblems } from '../../core/study/content.js';
import { addDays, isCalendarDate, localDate } from '../../core/dates.js';
import { cardSides } from '../../core/study/scheduler.js';

export const SCHEMA_VERSION = 1;
// PLACEHOLDER(Q-23): the trainer's defaults (learned = 2 right in a row both ways, 10 questions a round,
// Ъ written "ă", no starter vocabulary deck before the book) were chosen while Martin was away.
/** A letter counts as learned after this many right answers in a row in BOTH directions. */
export const LEARNED_STREAK = 2;
/** Questions in one practice round. */
export const ROUND_SIZE = 10;
/** Days of activity kept (enough for any streak worth showing). */
export const ACTIVITY_KEEP = 400;
export const HOME_DECK = 'home';
export const MAX_BG = 80;
export const MAX_EN = 120;

export const MODES = {
  'to-sound': { label: 'Letter → sound', stat: 'toSound' },
  'to-letter': { label: 'Sound → letter', stat: 'toLetter' },
  reading: { label: 'Reading practice', stat: null },
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const CYRILLIC = /[Ѐ-ӿ]/;

export function extendDefault(d) {
  return { ...d, alphabet: {}, reading: {}, activity: [], homeDeck: [] };
}

function statProblems(s, where) {
  if (!isObject(s) || !isCount(s.right) || !isCount(s.wrong) || !isCount(s.streak)) return [`${where} must be { right, wrong, streak } counts`];
  return [];
}

/** Problems with the Bulgarian fields; [] means complete (backup verify uses it). */
export function validateExtra(d) {
  const p = [];
  if (!isObject(d.alphabet)) p.push('alphabet must be an object');
  else {
    for (const [id, s] of Object.entries(d.alphabet)) {
      if (!isObject(s)) p.push(`alphabet.${id} must be an object`);
      else for (const k of ['toSound', 'toLetter']) if (s[k] !== undefined) p.push(...statProblems(s[k], `alphabet.${id}.${k}`));
    }
  }
  if (!isObject(d.reading)) p.push('reading must be an object');
  else for (const [id, s] of Object.entries(d.reading)) p.push(...statProblems(s, `reading.${id}`));
  if (!Array.isArray(d.activity) || !d.activity.every(isCalendarDate)) p.push('activity must be a list of dates (YYYY-MM-DD)');
  if (!Array.isArray(d.homeDeck)) p.push('homeDeck must be a list');
  else {
    const seen = new Set();
    d.homeDeck.forEach((c, i) => {
      const problems = cardProblems(c);
      if (problems.length) p.push(...problems.map((x) => `homeDeck[${i}]: ${x}`));
      else if (seen.has(c.id)) p.push(`homeDeck[${i}]: id ${c.id} is used twice`);
      else seen.add(c.id);
    });
  }
  return p;
}

// ---------- activity and streak ----------

/** Adds `today` to the activity days (once). */
export function markActivity(data, today = localDate()) {
  const days = Array.isArray(data.activity) ? data.activity : [];
  if (days.includes(today)) return data;
  return { ...data, activity: [...days, today].sort().slice(-ACTIVITY_KEEP) };
}

/** Days in a row with practice, ending today, or yesterday when today has none yet (still alive). */
export function streak(data, today = localDate()) {
  const days = new Set(data?.activity || []);
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

// ---------- alphabet and reading practice ----------

const bump = (s = { right: 0, wrong: 0, streak: 0 }, correct) =>
  correct ? { right: s.right + 1, wrong: s.wrong, streak: s.streak + 1 } : { right: s.right, wrong: s.wrong + 1, streak: 0 };

/** Records one practice answer (and today's activity). mode: to-sound | to-letter | reading. */
export function recordAnswer(data, mode, id, correct, today = localDate()) {
  let next;
  if (mode === 'reading') {
    next = { ...data, reading: { ...data.reading, [id]: bump(data.reading?.[id], correct) } };
  } else {
    const key = MODES[mode]?.stat;
    if (!key) throw new Error(`unknown practice mode "${mode}"`);
    const prev = data.alphabet?.[id] || {};
    next = { ...data, alphabet: { ...data.alphabet, [id]: { ...prev, [key]: bump(prev[key], correct) } } };
  }
  return markActivity(next, today);
}

const statOf = (data, mode, id) => (mode === 'reading' ? data.reading?.[id] : data.alphabet?.[id]?.[MODES[mode].stat]);

/** True when the letter was answered right LEARNED_STREAK times in a row both ways. */
export function letterLearned(data, id) {
  const s = data?.alphabet?.[id];
  return Boolean(s && (s.toSound?.streak ?? 0) >= LEARNED_STREAK && (s.toLetter?.streak ?? 0) >= LEARNED_STREAK);
}

export const lettersLearned = (data, letters) => letters.filter((l) => letterLearned(data, l.id)).length;

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A practice round: up to `size` questions [{ id, options: [4 ids, one of them id] }]. Letters (or words)
 * not yet known come first (streak below LEARNED_STREAK, weakest first), then the rest; the order and the
 * distractors are random. Reading distractors are words of similar length, so the length gives nothing away.
 */
export function buildRound(mode, { letters = [], words = [] }, data, rng = Math.random, size = ROUND_SIZE) {
  const items = mode === 'reading' ? words : letters;
  if (items.length < 4) return [];
  const ranked = shuffle(items, rng)
    .map((it) => ({ it, s: statOf(data, mode, it.id)?.streak ?? 0 }))
    .sort((a, b) => (a.s >= LEARNED_STREAK) - (b.s >= LEARNED_STREAK) || a.s - b.s)
    .map((x) => x.it);
  const chosen = shuffle(ranked.slice(0, size), rng);
  return chosen.map((it) => {
    let pool = items.filter((o) => o.id !== it.id);
    if (mode === 'reading') {
      pool = pool.filter((o) => o.latin !== it.latin);
      pool = shuffle(pool, rng)
        .sort((a, b) => Math.abs(a.latin.length - it.latin.length) - Math.abs(b.latin.length - it.latin.length))
        .slice(0, 8);
    }
    const distractors = shuffle(pool, rng).slice(0, 3);
    return { id: it.id, options: shuffle([it, ...distractors], rng).map((o) => o.id) };
  });
}

// ---------- transliteration ----------

/** The app's letter-by-letter Latin spelling of Bulgarian text, from the alphabet's `latin` fields. */
export function transliterate(text, letters) {
  const map = new Map(letters.map((l) => [l.lower, l.latin]));
  return [...String(text).normalize('NFC')]
    .map((ch) => {
      const lower = ch.toLocaleLowerCase('bg');
      const latin = map.get(lower);
      if (latin === undefined) return ch;
      return ch !== lower ? latin.charAt(0).toUpperCase() + latin.slice(1) : latin;
    })
    .join('');
}

// ---------- cards ----------

/** Words learned: cards whose every side (both directions of a two-way card) was last answered right. */
export function wordsLearned(cards, cardState = {}) {
  const sides = cardSides(cards);
  return cards.filter((c) => sides.filter((s) => s.card === c).every((s) => (cardState[s.key]?.reps ?? 0) >= 1)).length;
}

const clean = (v) => (typeof v === 'string' ? v.normalize('NFC').trim().replace(/\s+/g, ' ') : '');
/** The duplicate check: case, spacing and Unicode form do not matter. */
export const wordKey = (v) => clean(v).toLocaleLowerCase('bg');

/**
 * hub.offer('bulgarian', { bg, en, topic }) lands here (the module contract's accept). Pure: returns the new
 * data with a two-way "From my home" card, or null when the word is already a card (in the home deck or the
 * course) or the item is not a Bulgarian word with an English meaning.
 */
export function acceptOffer(item, data, { contentCards = [], now = new Date() } = {}) {
  if (!isObject(item) || !isObject(data)) return null;
  const bg = clean(item.bg);
  const en = clean(item.en);
  const topic = clean(item.topic) || HOME_DECK;
  if (!bg || !en || !CYRILLIC.test(bg) || bg.length > MAX_BG || en.length > MAX_EN) return null;
  const deck = Array.isArray(data.homeDeck) ? data.homeDeck : [];
  const key = wordKey(bg);
  if (deck.some((c) => wordKey(c.front) === key)) return null;
  if (contentCards.some((c) => (c.lang?.front || '').startsWith('bg') && wordKey(c.front) === key)) return null;
  if (contentCards.some((c) => (c.lang?.back || '').startsWith('bg') && wordKey(c.back) === key)) return null;
  const n = 1 + deck.reduce((max, c) => Math.max(max, Number(/^home-(\d+)$/.exec(c.id)?.[1] ?? 0)), 0);
  const card = { id: `home-${n}`, front: bg, back: en, topic, twoWay: true, lang: { front: 'bg', back: 'en' }, deck: HOME_DECK, added: localDate(now) };
  return { ...data, homeDeck: [...deck, card] };
}

/** Removes a home-deck card and the schedule of both its sides. */
export function removeHomeCard(data, id) {
  const cardState = { ...data.cardState };
  delete cardState[id];
  delete cardState[`${id}~rev`];
  return { ...data, homeDeck: data.homeDeck.filter((c) => c.id !== id), cardState };
}
