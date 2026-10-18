// Study content validation: every shipped content file must be valid (bad content fails HERE, never
// in the app), the sample course is valid, and the validator rejects each kind of bad item.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_FILES, checkCourse, chapterOf, kLevelsByObjective, loadCourse, manifestProblems } from '../../src/core/study/content.js';

const ROOT = join(import.meta.dirname, '..', '..');
const SAMPLE = join(ROOT, 'tests', 'fixtures', 'sample-course');

// A course folder may list its files in index.json (split per chapter); otherwise the default names.
const MANIFEST = 'index.json';
// Files a course folder may hold besides its course files (read by the module itself).
const EXTRA_FILES = ['objectives.json', 'handled-feedback.json', 'alphabet.json', 'reading.json'];

function courseFiles(dir) {
  if (!existsSync(join(dir, MANIFEST))) return DEFAULT_FILES;
  const m = JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8'));
  return { lessons: m.lessons || [], questions: m.questions || [], cards: m.cards || [] };
}

function readCourse(dir) {
  const files = courseFiles(dir);
  const read = (kind) => files[kind].flatMap((f) => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), 'utf8')) : []));
  return { lessons: read('lessons'), questions: read('questions'), cards: read('cards') };
}

const courseDirs = existsSync(join(ROOT, 'content'))
  ? readdirSync(join(ROOT, 'content')).filter((d) => statSync(join(ROOT, 'content', d)).isDirectory())
  : [];

describe('shipped content (content/<course>/)', () => {
  it('has no problems in any course', () => {
    for (const dir of courseDirs) {
      const { problems } = checkCourse(readCourse(join(ROOT, 'content', dir)));
      expect(problems, `content/${dir}`).toEqual([]);
    }
  });

  it('a manifest is well formed, every file it lists exists, and every JSON file is listed or a known extra', () => {
    for (const dir of courseDirs) {
      const full = join(ROOT, 'content', dir);
      if (!existsSync(join(full, MANIFEST))) continue;
      const m = JSON.parse(readFileSync(join(full, MANIFEST), 'utf8'));
      expect(manifestProblems(m), `content/${dir}/${MANIFEST}`).toEqual([]);
      const listed = Object.values(courseFiles(full)).flat();
      for (const f of listed) expect(existsSync(join(full, f)), `content/${dir}/${f} (listed in ${MANIFEST})`).toBe(true);
      for (const f of readdirSync(full).filter((x) => x.endsWith('.json') && x !== MANIFEST)) {
        expect([...listed, ...EXTRA_FILES], `content/${dir}/${f} is in no list: add it to ${MANIFEST} or EXTRA_FILES`).toContain(f);
      }
    }
  });

  it('every JSON file under content/ parses', () => {
    for (const dir of courseDirs) {
      for (const f of readdirSync(join(ROOT, 'content', dir)).filter((x) => x.endsWith('.json'))) {
        expect(() => JSON.parse(readFileSync(join(ROOT, 'content', dir, f), 'utf8')), `content/${dir}/${f}`).not.toThrow();
      }
    }
  });
});

describe('the sample course (tests/fixtures/sample-course)', () => {
  it('is valid', () => {
    expect(checkCourse(readCourse(SAMPLE)).problems).toEqual([]);
  });
});

const goodQ = {
  id: 'q1',
  objective: 'X-1.1',
  kLevel: 'K2',
  stem: 'Stem?',
  options: ['a', 'b', 'c', 'd'],
  answer: 'C',
  why: 'Because.',
  distractorNotes: { A: 'no', B: 'no', D: 'no' },
  source: 'generated',
};
const goodL = { id: 'l1', chapter: 1, section: '1.1', title: 'T', objectives: ['X-1.1'], body: 'Text' };
const goodC = { id: 'c1', front: 'Здравей', back: 'Hello', topic: 'Greetings', twoWay: true };

describe('checkCourse rejects bad content', () => {
  it('accepts a good course', () => {
    expect(checkCourse({ lessons: [goodL], questions: [goodQ], cards: [goodC] }).problems).toEqual([]);
  });

  it.each([
    ['three options', { options: ['a', 'b', 'c'] }, /exactly 4/],
    ['duplicate options', { options: ['a', 'a', 'c', 'd'] }, /different/],
    ['answer not a letter', { answer: 'E' }, /answer/],
    ['bad K-level', { kLevel: 'K4' }, /kLevel/],
    ['no why', { why: '' }, /why/],
    ['missing distractor note', { distractorNotes: { A: 'no', B: 'no' } }, /distractorNotes.D/],
    ['note on the correct option', { distractorNotes: { A: 'no', B: 'no', C: 'yes', D: 'no' } }, /must not explain/],
    ['no source', { source: undefined }, /source/],
    ['bad difficulty', { difficulty: 5 }, /difficulty/],
    ['objective in no lesson and no chapter', { objective: 'Y-9.9' }, /in no lesson/],
  ])('question: %s', (_name, change, pattern) => {
    const { problems, course } = checkCourse({ lessons: [goodL], questions: [{ ...goodQ, ...change }] });
    expect(problems.join('\n')).toMatch(pattern);
    expect(course.questions).toHaveLength(0);
  });

  it('accepts a question without a lesson when it names its chapter', () => {
    expect(checkCourse({ lessons: [goodL], questions: [{ ...goodQ, objective: 'Y-1.1', chapter: 1 }] }).problems).toEqual([]);
  });

  it.each([
    ['no objectives', { objectives: [] }, /objectives/],
    ['chapter as text', { chapter: '1' }, /chapter/],
    ['no body', { body: ' ' }, /body/],
  ])('lesson: %s', (_name, change, pattern) => {
    expect(checkCourse({ lessons: [{ ...goodL, ...change }] }).problems.join('\n')).toMatch(pattern);
  });

  it.each([
    ['no back', { back: '' }, /back/],
    ['twoWay missing', { twoWay: undefined }, /twoWay/],
    ['~ in the id', { id: 'a~b' }, /~/],
    ['bad lang', { lang: 'bg' }, /lang/],
  ])('card: %s', (_name, change, pattern) => {
    expect(checkCourse({ cards: [{ ...goodC, ...change }] }).problems.join('\n')).toMatch(pattern);
  });

  it('rejects duplicate ids and non-lists', () => {
    expect(checkCourse({ lessons: [goodL, goodL] }).problems.join()).toMatch(/used twice/);
    expect(checkCourse({ questions: {} }).problems.join()).toMatch(/must be a list/);
  });
});

describe('loadCourse (runtime)', () => {
  const fakeFetch = (files) => async (url) => {
    const name = url.split('/').pop();
    if (!(name in files)) return { ok: false, status: 404 };
    return { ok: true, json: async () => files[name] };
  };

  it('keeps the good items, drops the bad ones and reports them, never throws', async () => {
    const { course, problems } = await loadCourse(
      'http://x/content/c/',
      fakeFetch({ 'lessons.json': [goodL], 'questions.json': [goodQ, { ...goodQ, id: 'bad', options: [] }] }),
    );
    expect(course.lessons).toHaveLength(1);
    expect(course.questions.map((q) => q.id)).toEqual(['q1']);
    expect(course.cards).toEqual([]);
    expect(problems.join('\n')).toMatch(/cards.json could not be loaded/);
    expect(problems.join('\n')).toMatch(/questions\[1\] \(bad\)/);
  });

  it('with a manifest, loads the listed files in order and concatenates them', async () => {
    const l2 = { ...goodL, id: 'l2', section: '1.2' };
    const { course, problems } = await loadCourse(
      'http://x/content/c/',
      fakeFetch({
        'index.json': { lessons: ['lessons-a.json', 'lessons-b.json'], questions: ['q-1.json', 'q-missing.json'], cards: [] },
        'lessons-a.json': [goodL],
        'lessons-b.json': [l2],
        'q-1.json': [goodQ],
      }),
      { manifest: 'index.json' },
    );
    expect(course.lessons.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(course.questions.map((q) => q.id)).toEqual(['q1']);
    expect(problems).toEqual(['q-missing.json could not be loaded (HTTP 404)']);
  });

  it('reports a missing or bad manifest without throwing', async () => {
    const missing = await loadCourse('http://x/c/', fakeFetch({}), { manifest: 'index.json' });
    expect(missing.course).toEqual({ lessons: [], questions: [], cards: [] });
    expect(missing.problems).toEqual(['index.json could not be loaded (HTTP 404)']);
    const bad = await loadCourse('http://x/c/', fakeFetch({ 'index.json': { lessons: ['../x.json'] } }), { manifest: 'index.json' });
    expect(bad.problems.join()).toMatch(/manifest.lessons/);
  });

  it('survives a network failure', async () => {
    const { course, problems } = await loadCourse('http://x/c/', async () => {
      throw new Error('offline');
    });
    expect(course).toEqual({ lessons: [], questions: [], cards: [] });
    expect(problems).toHaveLength(3);
  });
});

describe('helpers', () => {
  it('chapterOf uses the question chapter, else its lesson', () => {
    expect(chapterOf(goodQ, [goodL])).toBe(1);
    expect(chapterOf({ ...goodQ, chapter: 4 }, [goodL])).toBe(4);
    expect(chapterOf({ ...goodQ, objective: 'none' }, [goodL])).toBe(null);
  });

  it('K-levels come from the questions', () => {
    expect(kLevelsByObjective([goodQ])).toEqual({ 'X-1.1': 'K2' });
  });
});
