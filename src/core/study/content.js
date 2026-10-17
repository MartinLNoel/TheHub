// Study content: validation and loading of content/<course>/lessons.json, questions.json, cards.json.
// Shapes (docs/plans/part-0-overview.md, "Study engine data"):
//   lesson   { id, chapter, section, title, objectives: [code], body }               body: markdown subset
//   question { id, objective, kLevel: "K1"|"K2"|"K3", stem, options: [4 strings], answer: "A".."D",
//              why, distractorNotes: { <each wrong letter>: text }, source, chapter?, difficulty? 1..3 }
//   card     { id, front, back, topic, twoWay, lang?: { front, back }, objective? }
// Bad content must fail a unit test (tests/unit/study-content.test.js checks every content file), never
// the app: at runtime the loader drops bad items and reports them, so one typo never blanks a course.

export const LETTERS = ['A', 'B', 'C', 'D'];
export const K_LEVELS = ['K1', 'K2', 'K3'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string' && v.trim().length > 0;

export function lessonProblems(l) {
  if (!isObject(l)) return ['is not an object'];
  const p = [];
  if (!text(l.id)) p.push('id is required');
  if (!Number.isInteger(l.chapter) || l.chapter < 0) p.push('chapter must be a whole number');
  if (!text(l.section)) p.push('section is required (e.g. "3.1")');
  if (!text(l.title)) p.push('title is required');
  if (!Array.isArray(l.objectives) || l.objectives.length === 0 || !l.objectives.every(text)) {
    p.push('objectives must be a non-empty list of codes');
  }
  if (!text(l.body)) p.push('body is required');
  return p;
}

export function questionProblems(q) {
  if (!isObject(q)) return ['is not an object'];
  const p = [];
  if (!text(q.id)) p.push('id is required');
  if (!text(q.objective)) p.push('objective is required');
  if (!K_LEVELS.includes(q.kLevel)) p.push(`kLevel must be one of ${K_LEVELS.join(', ')}`);
  if (!text(q.stem)) p.push('stem is required');
  if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(text)) {
    p.push('options must be exactly 4 non-empty texts (A to D)');
  } else if (new Set(q.options.map((o) => o.trim())).size !== 4) {
    p.push('options must all be different');
  }
  if (!LETTERS.includes(q.answer)) p.push('answer must be "A", "B", "C" or "D"');
  if (!text(q.why)) p.push('why is required (why the answer is correct)');
  if (!isObject(q.distractorNotes)) p.push('distractorNotes must be an object { letter: why it is wrong }');
  else if (LETTERS.includes(q.answer)) {
    for (const letter of LETTERS.filter((x) => x !== q.answer)) {
      if (!text(q.distractorNotes[letter])) p.push(`distractorNotes.${letter} is required (why ${letter} is wrong)`);
    }
    if (q.distractorNotes[q.answer] !== undefined) p.push('distractorNotes must not explain the correct option');
  }
  if (!text(q.source)) p.push('source is required (e.g. "generated")');
  if (q.chapter !== undefined && (!Number.isInteger(q.chapter) || q.chapter < 0)) p.push('chapter must be a whole number');
  if (q.difficulty !== undefined && ![1, 2, 3].includes(q.difficulty)) p.push('difficulty must be 1, 2 or 3');
  return p;
}

export function cardProblems(c) {
  if (!isObject(c)) return ['is not an object'];
  const p = [];
  if (!text(c.id)) p.push('id is required');
  else if (c.id.includes('~')) p.push('id must not contain "~" (it marks the reverse side)');
  if (!text(c.front)) p.push('front is required');
  if (!text(c.back)) p.push('back is required');
  if (!text(c.topic)) p.push('topic is required');
  if (typeof c.twoWay !== 'boolean') p.push('twoWay must be true or false');
  if (c.lang !== undefined && (!isObject(c.lang) || ![c.lang.front, c.lang.back].every((x) => x === undefined || text(x)))) {
    p.push('lang must be { front, back } language codes, e.g. { "front": "bg", "back": "en" }');
  }
  return p;
}

function checkList(kind, list, itemProblems, problems) {
  const good = [];
  if (!Array.isArray(list)) {
    problems.push(`${kind}: must be a list`);
    return good;
  }
  const seen = new Set();
  list.forEach((item, i) => {
    const where = `${kind}[${i}]${item && text(item.id) ? ` (${item.id})` : ''}`;
    const p = itemProblems(item);
    if (!p.length && seen.has(item.id)) p.push('id is used twice');
    if (p.length) problems.push(...p.map((x) => `${where}: ${x}`));
    else {
      seen.add(item.id);
      good.push(item);
    }
  });
  return good;
}

/**
 * Checks a whole course. Returns { problems, course } where `course` holds only the good items, so a
 * caller may use it even when there are problems. Cross-checks: every question's objective must be
 * taught by a lesson unless it carries its own `chapter` (ISTQB Ch1–2 questions have no lessons).
 */
export function checkCourse({ lessons = [], questions = [], cards = [] } = {}) {
  const problems = [];
  const goodLessons = checkList('lessons', lessons, lessonProblems, problems);
  const goodCards = checkList('cards', cards, cardProblems, problems);
  const taught = new Set(goodLessons.flatMap((l) => l.objectives));
  const goodQuestions = checkList(
    'questions',
    questions,
    (q) => {
      const p = questionProblems(q);
      if (!p.length && q.chapter === undefined && !taught.has(q.objective)) {
        p.push(`objective ${q.objective} is in no lesson; give the question a "chapter"`);
      }
      return p;
    },
    problems,
  );
  return { problems, course: { lessons: goodLessons, questions: goodQuestions, cards: goodCards } };
}

/** The chapter a question counts towards in mocks: its own `chapter`, else its objective's lesson. */
export function chapterOf(question, lessons) {
  if (Number.isInteger(question.chapter)) return question.chapter;
  const lesson = lessons.find((l) => l.objectives.includes(question.objective));
  return lesson ? lesson.chapter : null;
}

/** K-level per objective, taken from the questions that test it (they are matched to its K-level). */
export function kLevelsByObjective(questions) {
  const out = {};
  for (const q of questions) if (!out[q.objective]) out[q.objective] = q.kLevel;
  return out;
}

/**
 * Loads a course from `base` (a URL ending in "/"): fetches lessons.json, questions.json, cards.json.
 * A missing or broken file counts as empty and is reported. Never throws.
 */
export async function loadCourse(base, fetchFn = globalThis.fetch) {
  const raw = {};
  const problems = [];
  for (const name of ['lessons', 'questions', 'cards']) {
    try {
      const res = await fetchFn(new URL(`${name}.json`, base).href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw[name] = await res.json();
    } catch (err) {
      raw[name] = [];
      problems.push(`${name}.json could not be loaded (${err.message})`);
    }
  }
  const checked = checkCourse(raw);
  return { course: checked.course, problems: [...problems, ...checked.problems] };
}
