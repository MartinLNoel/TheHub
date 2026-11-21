// The Bulgarian alphabet trainer's content: content/bulgarian/alphabet.json (the 30 letters) and
// reading.json (short everyday words for reading practice), named in the course manifest index.json, and
// handled-feedback.json (feedback ids the content loop has handled, docs/content-loop.md).
// Written in our own words, independent of the course book (docs/bulgarian-content-guide.md).
// Bad content fails tests/unit/bulgarian-content.test.js; at runtime bad items are dropped and listed.
import { transliterate } from './data.js';

export const BASE = 'content/bulgarian/';
export const MANIFEST = 'index.json';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const isCyrillicLetter = (ch) => typeof ch === 'string' && [...ch].length === 1 && /^[Ѐ-ӿ]$/.test(ch);
/** Characters a reading word may hold besides the alphabet's letters. */
const WORD_EXTRAS = /^[ \-?!,.]$/;

/** letter { id, upper, lower, latin, sound, approx, example: { bg, latin, en }, russian? } */
export function letterProblems(l) {
  if (!isObject(l)) return ['is not an object'];
  const p = [];
  if (!text(l.id) || !/^[a-z]+$/.test(l.id)) p.push('id must be lower-case Latin letters');
  if (!isCyrillicLetter(l.upper)) p.push('upper must be one Cyrillic letter');
  if (!isCyrillicLetter(l.lower)) p.push('lower must be one Cyrillic letter');
  if (isCyrillicLetter(l.upper) && isCyrillicLetter(l.lower) && l.upper.toLocaleLowerCase('bg') !== l.lower) p.push('lower must be the lower case of upper');
  for (const k of ['latin', 'sound', 'approx']) if (!text(l[k])) p.push(`${k} is required`);
  if (l.russian !== undefined && !text(l.russian)) p.push('russian must be a text when given');
  if (!isObject(l.example) || !['bg', 'latin', 'en'].every((k) => text(l.example[k]))) p.push('example must be { bg, latin, en }');
  return p;
}

const isStressed = (syllable) => /[a-zа-яă]/i.test(syllable) && syllable === syllable.toUpperCase();

/**
 * A word's pronunciation (0.9.14): its Latin form in syllables split by "-", the stressed syllable in capitals,
 * e.g. "zdra-VEY", "do-BRO U-tro"; a word may have no stress of its own ("KAK si"), but never two.
 */
export function sayProblems(say, latin) {
  if (!text(say)) return ['say must be a text when given'];
  const p = [];
  if (text(latin) && say.replace(/-/g, '').toLowerCase() !== latin.toLowerCase()) p.push(`say "${say}" does not spell the Latin form "${latin}"`);
  const words = say.split(' ').map((w) => w.split('-'));
  if (words.some((sylls) => sylls.some((s) => !s))) p.push(`say "${say}" has an empty syllable`);
  if (words.some((sylls) => sylls.filter(isStressed).length > 1)) p.push(`say "${say}" stresses two syllables in one word`);
  if (!words.some((sylls) => sylls.some(isStressed))) p.push(`say "${say}" has no stressed syllable`);
  if (words.flat().some((s) => !isStressed(s) && s !== s.toLowerCase())) p.push(`say "${say}" mixes capitals inside a syllable`);
  return p;
}

/** word { id, bg, latin, say?, en, topic, note? }; `letters` checks the spelling and the Latin form. */
export function wordProblems(w, letters = []) {
  if (!isObject(w)) return ['is not an object'];
  const p = [];
  if (!text(w.id)) p.push('id is required');
  for (const k of ['bg', 'latin', 'en', 'topic']) if (!text(w[k])) p.push(`${k} is required`);
  if (w.note !== undefined && !text(w.note)) p.push('note must be a text when given');
  if (w.say !== undefined) p.push(...sayProblems(w.say, w.latin));
  if (text(w.bg) && letters.length) {
    const known = new Set(letters.flatMap((l) => [l.upper, l.lower]));
    const bad = [...w.bg].filter((ch) => !known.has(ch) && !WORD_EXTRAS.test(ch));
    if (bad.length) p.push(`bg has characters that are not Bulgarian letters: ${[...new Set(bad)].join(' ')}`);
    else if (text(w.latin) && transliterate(w.bg, letters) !== w.latin) p.push(`latin is "${w.latin}", but the letters spell "${transliterate(w.bg, letters)}"`);
  }
  return p;
}

function checkList(kind, list, itemProblems, unique, problems) {
  if (!Array.isArray(list)) {
    problems.push(`${kind}: must be a list`);
    return [];
  }
  const seen = Object.fromEntries(unique.map((k) => [k, new Set()]));
  return list.filter((item, i) => {
    const where = `${kind}[${i}]${isObject(item) && text(item.id) ? ` (${item.id})` : ''}`;
    const p = itemProblems(item);
    if (!p.length) for (const k of unique) if (seen[k].has(item[k])) p.push(`${k} "${item[k]}" is used twice`);
    if (p.length) {
      problems.push(...p.map((x) => `${where}: ${x}`));
      return false;
    }
    for (const k of unique) seen[k].add(item[k]);
    return true;
  });
}

/** Checks both files. Returns { problems, alphabet: { notes, letters }, reading } with only the good items. */
export function checkTrainer(alphabet, reading) {
  const problems = [];
  if (!isObject(alphabet)) problems.push('alphabet: must be an object { notes, letters }');
  const notes = Array.isArray(alphabet?.notes) ? alphabet.notes.filter(text) : [];
  if (isObject(alphabet) && !Array.isArray(alphabet.notes)) problems.push('alphabet.notes: must be a list');
  const letters = checkList('letters', alphabet?.letters, letterProblems, ['id', 'upper', 'sound'], problems);
  const words = checkList('reading', reading, (w) => wordProblems(w, letters), ['id', 'bg'], problems);
  return { problems, alphabet: { notes, letters }, reading: words };
}

// ---------- loading (once, network first, then the offline cache; never throws) ----------

let cache = { problems: [], alphabet: { notes: [], letters: [] }, reading: [], handled: [] };
let loading = null;

/** What has loaded so far (empty lists until getTrainer() has finished). */
export const trainer = () => cache;

export function getTrainer(fetchFn = globalThis.fetch) {
  if (!loading) {
    loading = (async () => {
      const base = new URL(BASE, globalThis.document?.baseURI ?? globalThis.location?.href).href;
      const problems = [];
      const get = async (name) => {
        try {
          const res = await fetchFn(new URL(name, base).href);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (err) {
          problems.push(`${name} could not be loaded (${err.message})`);
          return null;
        }
      };
      const manifest = (await get(MANIFEST)) || {};
      const [alphabet, reading, handled] = await Promise.all([
        get(manifest.alphabet || 'alphabet.json'),
        get(manifest.reading || 'reading.json'),
        get('handled-feedback.json'),
      ]);
      const checked = checkTrainer(alphabet || { notes: [], letters: [] }, reading || []);
      cache = { ...checked, problems: [...problems, ...checked.problems], handled: Array.isArray(handled) ? handled.filter((x) => typeof x === 'string') : [] };
      return cache;
    })();
  }
  return loading;
}

/** Tests only: set the trainer content directly. */
export function setTrainer(alphabet, reading, handled = []) {
  cache = { ...checkTrainer(alphabet, reading), handled };
  loading = Promise.resolve(cache);
}
