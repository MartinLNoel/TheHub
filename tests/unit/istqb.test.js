// The ISTQB module (Part 6): the 64 objectives, the content rules, the official mock weighting,
// chapter completion, the readiness gate, the 10-day warm-up, the Notion progress import and the
// in-app importer, the Today card and the home summary.
import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkCourse, chapterOf } from '../../src/core/study/content.js';
import { defaultProgress, validateProgress } from '../../src/core/study/progress.js';
import { buildSession } from '../../src/core/study/session.js';
import { pickMockQuestions, startMock } from '../../src/core/study/mock.js';
import { checkModule } from '../../src/core/registry.js';
import istqb, { todayCard } from '../../src/modules/istqb/index.js';
import {
  OFFICIAL_WEIGHTING, addWarmup, adjustSession, chaptersDone, chaptersTaught, daysSinceLastSession, mockConfigs, needsWarmup,
  nextStep, readiness, studiedObjectives, wrongAnswers,
} from '../../src/modules/istqb/rules.js';
import { prepareIstqbImport, progressSummary } from '../../src/modules/istqb/import.js';
import { buildRetrySession, homeCards, setExtras } from '../../src/modules/istqb/screens.js';
import { convertNotionExtract } from '../../scripts/istqb-import.mjs';
import { buildBackup } from '../../src/core/transfer.js';

const ROOT = join(import.meta.dirname, '..', '..');
const DIR = join(ROOT, 'content', 'istqb');
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const OBJECTIVES = readJSON(join(DIR, 'objectives.json'));
const MANIFEST = readJSON(join(DIR, 'index.json'));
const readKind = (kind) => MANIFEST[kind].flatMap((f) => readJSON(join(DIR, f)));
const SHIPPED = { lessons: readKind('lessons'), questions: readKind('questions'), cards: readKind('cards') };
const LO = new Map(OBJECTIVES.map((o) => [o.code, o]));
const fixedRng = () => 0;

// ---------- a synthetic full course: 8 questions for every objective, one lesson per Ch3–6 section ----------

function syntheticCourse() {
  const sections = [...new Set(OBJECTIVES.filter((o) => o.chapter >= 3).map((o) => o.section))];
  const lessons = sections.map((s) => ({
    id: s,
    chapter: Number(s.split('.')[0]),
    section: s,
    title: `Section ${s}`,
    objectives: OBJECTIVES.filter((o) => o.section === s).map((o) => o.code),
    body: 'Text',
  }));
  const questions = OBJECTIVES.flatMap((o) =>
    Array.from({ length: 8 }, (_, i) => ({
      id: `${o.code}-${i}`,
      objective: o.code,
      kLevel: o.kLevel,
      chapter: o.chapter,
      stem: `Stem ${o.code} ${i}?`,
      options: ['a', 'b', 'c', 'd'],
      answer: 'A',
      why: 'Because.',
      distractorNotes: { B: 'no', C: 'no', D: 'no' },
      source: 'generated',
    })),
  );
  const checked = checkCourse({ lessons, questions, cards: [] });
  expect(checked.problems).toEqual([]);
  return checked.course;
}
const FULL = syntheticCourse();

const session = (o) => ({ date: '2026-07-01', correct: 0, total: 0, ...o });

// ---------- objectives ----------

describe('the 64 learning objectives (content/istqb/objectives.json)', () => {
  it('has 64 unique objectives: 14 K1, 42 K2, 8 K3', () => {
    expect(OBJECTIVES).toHaveLength(64);
    expect(new Set(OBJECTIVES.map((o) => o.code)).size).toBe(64);
    const k = (l) => OBJECTIVES.filter((o) => o.kLevel === l).length;
    expect([k('K1'), k('K2'), k('K3')]).toEqual([14, 42, 8]);
  });

  it('per chapter: 14 · 10 · 8 · 14 · 16 · 2, codes match chapter and section', () => {
    const per = [1, 2, 3, 4, 5, 6].map((c) => OBJECTIVES.filter((o) => o.chapter === c).length);
    expect(per).toEqual([14, 10, 8, 14, 16, 2]);
    for (const o of OBJECTIVES) {
      expect(o.code).toMatch(/^FL-\d\.\d\.\d$/);
      expect(o.code.startsWith(`FL-${o.section}.`)).toBe(true);
      expect(o.section.startsWith(`${o.chapter}.`)).toBe(true);
      expect(o.title.length).toBeGreaterThan(5);
    }
  });

  it('the K3 objectives are the eight the exam always tests', () => {
    expect(OBJECTIVES.filter((o) => o.kLevel === 'K3').map((o) => o.code)).toEqual([
      'FL-4.2.1', 'FL-4.2.2', 'FL-4.2.3', 'FL-4.2.4', 'FL-4.5.3', 'FL-5.1.4', 'FL-5.1.5', 'FL-5.5.1',
    ]);
  });
});

// ---------- shipped content ----------

describe('shipped ISTQB content (content/istqb/)', () => {
  it('is valid for the engine', () => {
    expect(checkCourse(SHIPPED).problems).toEqual([]);
  });

  it('lists every content file in index.json', () => {
    const files = readdirSync(DIR).filter((f) => /^(lessons|questions)-ch\d\.json$/.test(f));
    expect(files.sort()).toEqual([...MANIFEST.lessons, ...MANIFEST.questions].sort());
    for (const f of [...MANIFEST.lessons, ...MANIFEST.questions, ...MANIFEST.cards]) expect(existsSync(join(DIR, f))).toBe(true);
  });

  it('has no lessons for Chapters 1–2 (Martin studied them before TheHub), and lesson ids are their sections', () => {
    for (const f of MANIFEST.lessons) expect(f).toMatch(/^lessons-ch[3-6]\.json$/);
    for (const l of SHIPPED.lessons) {
      expect(l.chapter).toBeGreaterThanOrEqual(3);
      // A long section may be split into parts: "4.2a", "4.2b" (docs/istqb-content-guide.md, Lessons).
      expect([l.section, `${l.section}a`, `${l.section}b`, `${l.section}c`], l.id).toContain(l.id);
      for (const o of l.objectives) {
        expect(LO.has(o), `${l.id}: ${o}`).toBe(true);
        expect(LO.get(o).chapter, `${l.id}: ${o}`).toBe(l.chapter);
      }
    }
  });

  it('every question names a real objective, its K-level and its chapter, in the right file', () => {
    for (const f of MANIFEST.questions) {
      const ch = Number(/ch(\d)/.exec(f)[1]);
      for (const q of readJSON(join(DIR, f))) {
        const o = LO.get(q.objective);
        expect(o, `${q.id}: objective ${q.objective}`).toBeTruthy();
        expect(q.kLevel, `${q.id}: K-level of ${q.objective}`).toBe(o.kLevel);
        expect(q.chapter, `${q.id}: chapter`).toBe(o.chapter);
        expect(o.chapter, `${q.id} is in ${f}`).toBe(ch);
        expect(q.source).toBe('generated');
      }
    }
  });

  it('lessons run in course order, and the lesson after §3.2 is §4.1 (QUESTIONS.md Q-17)', () => {
    const ids = SHIPPED.lessons.map((l) => l.id);
    const sections = SHIPPED.lessons.map((l) => l.section.split('.').map(Number));
    for (let i = 1; i < sections.length; i++) {
      const [a, b] = [sections[i - 1], sections[i]];
      expect(a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]), `${ids[i - 1]} before ${ids[i]}`).toBe(true);
    }
    expect(ids.indexOf('4.1')).toBe(ids.indexOf('3.2') + 1);
    expect(ids.slice(ids.indexOf('4.1'), ids.indexOf('4.5') + 1)).toEqual(['4.1', '4.2a', '4.2b', '4.3', '4.4', '4.5']);
  });

  it('Chapter 4: each K3 objective has at least 10 questions (the Ch4 run target)', () => {
    for (const o of OBJECTIVES.filter((x) => x.chapter === 4 && x.kLevel === 'K3')) {
      const n = SHIPPED.questions.filter((q) => q.objective === o.code).length;
      expect(n, `${o.code} has ${n} questions`).toBeGreaterThanOrEqual(10);
    }
  });

  it('question stems never name a mnemonic (standing rule SR-2)', () => {
    for (const q of SHIPPED.questions) expect(q.stem, q.id).not.toMatch(/PMADIEC|2-3-2|CIRAP|I-WTI|INVEST|3 C's|PIICF/);
  });

  it('every card names a real objective', () => {
    for (const c of SHIPPED.cards) if (c.objective) expect(LO.has(c.objective), c.id).toBe(true);
  });

  // Add each chapter here when its content run is finished (Ch3 and Ch6 done 2026-10-17, Ch4 2026-10-18; still to
  // come: Ch5, then the Ch1–2 questions); docs/content-loop.md and docs/istqb-content-guide.md say when.
  const FINISHED_CHAPTERS = [3, 4, 6];
  const minimum = (o) => (o.kLevel === 'K3' ? 8 : 6);

  // Skipped (pending) while no chapter is finished yet.
  const eachFinished = FINISHED_CHAPTERS.length ? it.each(FINISHED_CHAPTERS) : it.skip.each(['(none finished yet)']);
  eachFinished('chapter %s: every objective has at least 6 questions (K3: 8)', (ch) => {
    for (const o of OBJECTIVES.filter((x) => x.chapter === ch)) {
      const n = SHIPPED.questions.filter((q) => q.objective === o.code).length;
      expect(n, `${o.code} has ${n} questions`).toBeGreaterThanOrEqual(minimum(o));
    }
  });

  // PENDING until every content run has finished: then delete `.skip` (and FINISHED_CHAPTERS above).
  it.skip('all 64 objectives have at least 6 questions (K3: 8): the full bank (pending the content runs)', () => {
    for (const o of OBJECTIVES) {
      const n = SHIPPED.questions.filter((q) => q.objective === o.code).length;
      expect(n, `${o.code} has ${n} questions`).toBeGreaterThanOrEqual(minimum(o));
    }
  });
});

// ---------- mocks ----------

describe('mocks', () => {
  it('the full mock uses the official weighting: 40 questions, 60 minutes', () => {
    const full = mockConfigs().find((m) => m.id === 'full');
    expect(full.perChapter).toEqual({ 1: 8, 2: 6, 3: 4, 4: 11, 5: 9, 6: 2 });
    expect(Object.values(full.perChapter).reduce((a, b) => a + b, 0)).toBe(40);
    expect(full.minutes).toBe(60);
    const { questionIds, shortfall } = pickMockQuestions(FULL, defaultProgress(), { ...full, rng: fixedRng });
    expect(questionIds).toHaveLength(40);
    expect(shortfall).toEqual([]);
    const byId = new Map(FULL.questions.map((q) => [q.id, q]));
    const counts = {};
    for (const id of questionIds) {
      const c = chapterOf(byId.get(id), FULL.lessons);
      counts[c] = (counts[c] || 0) + 1;
    }
    expect(counts).toEqual(OFFICIAL_WEIGHTING);
  });

  it('a mini-mock has 10 questions: 7 from its chapter and 3 cumulative from earlier chapters', () => {
    for (const n of [3, 4, 5, 6]) {
      const mini = mockConfigs().find((m) => m.id === `mini-${n}`);
      const mock = startMock(FULL, defaultProgress(), mini, { rng: fixedRng });
      const chapters = mock.questionIds.map((id) => FULL.questions.find((q) => q.id === id).chapter);
      expect(chapters).toHaveLength(10);
      expect(chapters.filter((c) => c === n)).toHaveLength(7);
      expect(chapters.filter((c) => c < n)).toHaveLength(3);
      expect(mock.kind).toBe('mini-mock');
    }
  });

  it('the module offers the full mock and the Chapter 3–6 mini-mocks', () => {
    expect(mockConfigs().map((m) => m.id)).toEqual(['full', 'mini-3', 'mini-4', 'mini-5', 'mini-6']);
  });
});

// ---------- chapters and readiness ----------

describe('chapters X/6 and the readiness gate', () => {
  it('a chapter is done when its mini-mock scored at least 65 %', () => {
    const p = {
      ...defaultProgress(),
      sessions: [
        session({ no: 1, kind: 'mini-mock', section: 'mini-1', score: 80 }),
        session({ no: 2, kind: 'mini-mock', section: 'mini-3', score: 60 }),
        session({ no: 3, kind: 'mini-mock', section: 'mini-2', score: 65 }),
        session({ no: 4, kind: 'lesson', section: '3.1', score: 100 }),
      ],
    };
    expect(chaptersDone(p)).toEqual([1, 2]);
  });

  const full = (no, score, total = 40) => session({ no, kind: 'full-mock', section: 'full', score, total });

  it('Ready only after two CONSECUTIVE complete full mocks at 80 % or more', () => {
    const p = (sessions) => ({ ...defaultProgress(), sessions });
    expect(readiness(p([])).level).toBe('Not Ready');
    expect(readiness(p([session({ no: 1, kind: 'lesson', score: 90 })])).level).toBe('Building');
    expect(readiness(p([full(1, 85)]))).toMatchObject({ level: 'Approaching', gateMet: false });
    expect(readiness(p([full(1, 85), full(2, 80)]))).toMatchObject({ level: 'Ready', gateMet: true });
    expect(readiness(p([full(1, 85), full(2, 78), full(3, 90)])).gateMet).toBe(false);
    expect(readiness(p([full(1, 78), full(2, 85), full(3, 90)])).gateMet).toBe(true);
    expect(readiness(p([full(1, 90), full(2, 90), full(3, 70)])).gateMet).toBe(false);
  });

  it('a short full mock (the bank not full yet) never counts towards the gate', () => {
    const p = { ...defaultProgress(), sessions: [full(1, 100, 8), full(2, 100, 8)] };
    expect(readiness(p).gateMet).toBe(false);
  });

  it('all six chapters banked = Approaching', () => {
    const sessions = [1, 2, 3, 4, 5, 6].map((c) => session({ no: c, kind: 'mini-mock', section: `mini-${c}`, score: 70 }));
    expect(readiness({ ...defaultProgress(), sessions }).level).toBe('Approaching');
  });
});

// ---------- 10-day warm-up ----------

describe('the 10-day warm-up', () => {
  const studied = {
    ...defaultProgress(),
    sessions: [
      session({ no: 1, kind: 'lesson', section: '1.1', objectives: ['FL-1.1.1', 'FL-1.1.2'], date: '2026-10-01', score: 100 }),
      session({ no: 2, kind: 'mini-mock', section: 'mini-1', date: '2026-10-02', score: 80 }),
    ],
    pointer: '3.1',
  };

  it('counts whole days since the last session; more than 10 means a warm-up', () => {
    expect(daysSinceLastSession(studied, new Date(2026, 9, 12, 8))).toBe(10);
    expect(needsWarmup(studied, new Date(2026, 9, 12, 23))).toBe(false);
    expect(needsWarmup(studied, new Date(2026, 9, 13, 0, 5))).toBe(true);
    expect(needsWarmup(defaultProgress(), new Date())).toBe(false);
  });

  it('after the gap, the session opens with 5 cumulative warm-up questions instead of the review drill', () => {
    const p = { ...studied, reviewQueue: [{ id: 'r1', questionId: 'FL-1.2.3-0', objective: 'FL-1.2.3', addedSession: 1, dueSession: 2, step: 0, correctCount: 0 }] };
    const built = buildSession(FULL, p, { rng: fixedRng });
    expect(built.steps[0]).toMatchObject({ type: 'drill', reviewId: 'r1' });
    const s = adjustSession(built, FULL, p, new Date(2026, 9, 20), fixedRng);
    const warm = s.steps.filter((x) => x.warmup);
    expect(warm).toHaveLength(5);
    expect(s.steps.slice(0, 5)).toEqual(warm);
    expect(warm.every((x) => x.type === 'drill' && x.label === 'Warm-up')).toBe(true);
    expect(s.steps.some((x) => x.reviewId)).toBe(false); // the due item waits for the next session
    expect(s.steps.find((x) => x.type === 'lesson').lessonId).toBe('3.1');
    // Cumulative: only objectives already studied (Chapter 1 here), never the new lesson's.
    const studiedLos = studiedObjectives(FULL, p);
    for (const w of warm) expect(studiedLos.has(FULL.questions.find((q) => q.id === w.questionId).objective)).toBe(true);
    for (const w of warm) expect(FULL.questions.find((q) => q.id === w.questionId).chapter).toBe(1);
    expect(s.warmup).toEqual({ days: 18, size: 5 });
    // No question twice in the session.
    const ids = s.steps.map((x) => x.questionId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('within 10 days the session is unchanged', () => {
    const built = buildSession(FULL, studied, { rng: fixedRng });
    expect(adjustSession(built, FULL, studied, new Date(2026, 9, 5), fixedRng)).toBe(built);
  });

  it('with nothing studied yet the session is unchanged', () => {
    const p = { ...defaultProgress(), sessions: [session({ no: 1, kind: 'lesson', section: 'x', date: '2026-01-01' })] };
    const built = buildSession(FULL, p, { rng: fixedRng });
    expect(addWarmup(built, FULL, p, { rng: fixedRng })).toBe(built);
  });
});

// ---------- next step ----------

describe('the next step', () => {
  it('lesson → chapter mini-mock once every objective of the chapter is taught → next chapter', () => {
    const p = { ...defaultProgress(), pointer: '3.1', sessions: [session({ no: 1, kind: 'mini-mock', section: 'mini-1', score: 80 }), session({ no: 2, kind: 'mini-mock', section: 'mini-2', score: 90 })] };
    expect(nextStep(FULL, p, OBJECTIVES)).toMatchObject({ kind: 'lesson', lesson: { id: '3.1' } });
    const after3 = { ...p, pointer: '4.1' };
    expect(chaptersTaught(FULL, after3, OBJECTIVES)).toEqual([3]);
    expect(nextStep(FULL, after3, OBJECTIVES)).toEqual({ kind: 'mini-mock', chapter: 3 });
    const banked = { ...after3, sessions: [...after3.sessions, session({ no: 3, kind: 'mini-mock', section: 'mini-3', score: 70 })] };
    expect(nextStep(FULL, banked, OBJECTIVES)).toMatchObject({ kind: 'lesson', lesson: { id: '4.1' } });
  });

  it('a chapter whose lessons are not all written yet is not offered as taught', () => {
    const partial = { ...FULL, lessons: FULL.lessons.filter((l) => l.id === '3.1') };
    const p = { ...defaultProgress(), pointer: '__done__', sessions: [session({ no: 1, kind: 'lesson', section: '3.1', score: 100 })] };
    expect(chaptersTaught(partial, p, OBJECTIVES)).toEqual([]);
    expect(nextStep(partial, p, OBJECTIVES)).toEqual({ kind: 'waiting' });
  });

  it('all chapters banked → full mock, then ready', () => {
    const minis = [1, 2, 3, 4, 5, 6].map((c) => session({ no: c, kind: 'mini-mock', section: `mini-${c}`, score: 80 }));
    const p = { ...defaultProgress(), pointer: '__done__', sessions: [session({ no: 0, kind: 'lesson', section: '6.2' }), ...minis] };
    expect(nextStep(FULL, p, OBJECTIVES)).toEqual({ kind: 'full-mock' });
    const full = (no) => session({ no, kind: 'full-mock', section: 'full', score: 85, total: 40 });
    expect(nextStep(FULL, { ...p, sessions: [...p.sessions, full(7), full(8)] }, OBJECTIVES)).toEqual({ kind: 'ready' });
  });
});

// ---------- the Notion import ----------

const SYNTHETIC = readJSON(join(ROOT, 'tests', 'fixtures', 'istqb-notion.synthetic.json'));

describe('the Notion progress import (scripts/istqb-import.mjs) on a synthetic Notion-shaped fixture', () => {
  const { data, problems, warnings } = convertNotionExtract(SYNTHETIC, OBJECTIVES, { importedAt: '2026-10-17T10:00:00.000Z' });

  it('converts without problems into valid progress', () => {
    expect(problems).toEqual([]);
    expect(validateProgress(data)).toEqual([]);
    expect(warnings.join()).toMatch(/imported as untested/);
  });

  it('mastery: all 64 objectives, the ledger where known, untested elsewhere', () => {
    expect(Object.keys(data.mastery)).toHaveLength(64);
    expect(data.mastery['FL-1.1.1']).toBe('exam-ready');
    expect(data.mastery['FL-1.2.3']).toBe('shaky');
    expect(data.mastery['FL-3.1.1']).toBe('solid');
    expect(data.mastery['FL-6.2.1']).toBe('untested');
  });

  it('sessions: numbers, dates, scores, kinds; lessons keep their objectives; mini-mocks become mini-N', () => {
    expect(data.sessions.map((s) => [s.no, s.date, s.kind, s.section, s.score, s.correct, s.total])).toEqual([
      [1, '2026-01-05', 'lesson', '1.1', 67, 2, 3],
      [2, '2026-01-07', 'lesson', '1.2', 100, 2, 2],
      [3, '2026-01-09', 'mini-mock', 'mini-1', 75, 3, 4],
    ]);
    expect(data.sessions[0]).toMatchObject({ objectives: ['FL-1.1.1', 'FL-1.1.2'], calibration: 'on-pace', complete: true, imported: true });
    expect(chaptersDone(data)).toEqual([1]);
  });

  it('attempts: every result, with legacyText from the wrong-answer log', () => {
    expect(data.attempts).toHaveLength(10);
    const wrong = data.attempts.filter((a) => !a.correct);
    expect(wrong.map((a) => [a.questionId, a.objective, a.kind, a.chosen])).toEqual([
      ['notion-s1-D1', 'FL-1.2.3', 'drill', null],
      ['notion-s1-Q2', 'FL-1.1.2', 'quiz', 'A'],
      ['notion-s3-Q3', 'FL-1.2.3', 'mock', 'D'],
    ]);
    expect(wrong[0].legacyText).toBe('Question: Synthetic drill question?\nYour answer: a guess\nCorrect: the right term\nWhy it fooled you: a made-up reason');
    expect(wrong[1].answer).toBe('C');
    expect(data.attempts.find((a) => a.questionId === 'notion-s2-Q2').guess).toBe(true);
    expect(data.attempts.every((a) => a.at.startsWith('2026-01-0'))).toBe(true);
  });

  it('review queue, pointer, and the next session number', () => {
    expect(data.reviewQueue).toEqual([{ id: 'rq-syn-1', objective: 'FL-1.2.3', note: 'Synthetic review note', addedSession: 3, dueSession: 4, step: 0, correctCount: 0 }]);
    expect(data.pointer).toBe('3.1');
    expect(buildSession(FULL, data, { rng: fixedRng }).no).toBe(4);
    expect(data.legacy).toMatchObject({ importId: 'notion-v2-s3', newestSession: 3, importedAt: '2026-10-17T10:00:00.000Z' });
  });

  it('reports what cannot be mapped', () => {
    const bad = structuredClone(SYNTHETIC);
    bad.ledger['FL-9.9.9'] = 'solid';
    bad.ledger['FL-1.1.2'] = 'great';
    bad.sessions[0].results.push({ ref: 'Q9', kind: 'quiz', lo: 'FL-1.1.1', ok: true });
    bad.wrongAnswerLog.push({ session: 2, ref: 'Q7', question: '?', given: 'x', correct: 'y' });
    const r = convertNotionExtract(bad, OBJECTIVES);
    expect(r.problems.join('\n')).toMatch(/unknown objective FL-9.9.9/);
    expect(r.problems.join('\n')).toMatch(/FL-1.1.2 is "great"/);
    expect(r.problems.join('\n')).toMatch(/wrong-answer log 2\/Q7: no matching result/);
    expect(r.warnings.join('\n')).toMatch(/session 1: Notion score 67 % but the results give 75 %/);
    expect(convertNotionExtract({ format: 'x' }, OBJECTIVES).problems).toEqual(['not an istqb-notion-extract file (format version 1)']);
  });
});

// ---------- the in-app importer ----------

describe('Settings → Import ISTQB progress', () => {
  const { data } = convertNotionExtract(SYNTHETIC, OBJECTIVES, { importedAt: '2026-10-17T10:00:00.000Z' });
  let text;
  beforeEach(async () => {
    text = JSON.stringify(await buildBackup({ modules: { istqb: { schemaVersion: 1, data } }, appVersion: '0.6.0' }));
  });

  it('is offered by the module, which keeps the module contract', () => {
    expect(checkModule(istqb)).toEqual([]);
    expect(istqb.importers.map((i) => i.title)).toEqual(['Import ISTQB progress']);
    expect(istqb.study).toBe(true);
  });

  it('imports into a fresh module, keeping feedback and cards made in TheHub', () => {
    const current = { ...istqb.defaultData(), feedback: [{ id: 'f1', targetId: '3.1', text: 'typo', at: '2026-10-16', resolved: false }], cardState: { 't-xp': { reps: 1 } } };
    const r = prepareIstqbImport(text, current);
    expect(r.ok).toBe(true);
    expect(r.data.sessions).toHaveLength(3);
    expect(r.data.feedback.map((f) => f.id)).toEqual(['f1']);
    expect(r.data.cardState).toEqual({ 't-xp': { reps: 1 } });
    expect(istqb.validate(r.data)).toEqual([]);
    expect(r.summary.join('\n')).toMatch(/Sessions: 3 \(last: session 3, 2026-01-09\)/);
    expect(r.summary.join('\n')).toMatch(/Chapters done: 1\/6/);
  });

  it('importing the same file again changes nothing', () => {
    const first = prepareIstqbImport(text, istqb.defaultData()).data;
    expect(prepareIstqbImport(text, first)).toMatchObject({ ok: true, nothingNew: true });
  });

  it('refuses to overwrite study done in TheHub', () => {
    const own = { ...istqb.defaultData(), sessions: [{ no: 1, date: '2026-10-17', kind: 'lesson', section: '3.1', score: 80 }] };
    const r = prepareIstqbImport(text, own);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/already has ISTQB study of its own \(1 session\)/);
  });

  it('rejects files that are not ISTQB progress', () => {
    expect(prepareIstqbImport('nope', istqb.defaultData()).ok).toBe(false);
    expect(prepareIstqbImport('{"format":"x"}', istqb.defaultData()).problems[0]).toMatch(/not a TheHub progress file/);
    expect(prepareIstqbImport(JSON.stringify({ format: 'thehub-backup', modules: { gym: {} } }), istqb.defaultData()).problems[0]).toMatch(/no ISTQB/);
    const v2 = JSON.parse(text);
    v2.modules.istqb.schemaVersion = 2;
    expect(prepareIstqbImport(JSON.stringify(v2), istqb.defaultData()).problems[0]).toMatch(/version 2/);
    const broken = JSON.parse(text);
    broken.modules.istqb.data.attempts = 'x';
    expect(prepareIstqbImport(JSON.stringify(broken), istqb.defaultData()).problems.join()).toMatch(/attempts must be a list/);
  });
});

// ---------- Today card, home summary, wrong-answer review ----------

describe('Today card and screens', () => {
  const { data } = convertNotionExtract(SYNTHETIC, OBJECTIVES);
  const course = checkCourse(SHIPPED).course;

  it('Today: the next session, review items due, days since the last session, chapters and readiness', () => {
    const card = todayCard(data, course, OBJECTIVES, new Date(2026, 0, 30));
    expect(card.title).toBe('ISTQB');
    expect(card.lines).toEqual([
      'Next: session 4, 3.1 Static testing basics',
      'Review items due: 1',
      'Last session: 21 days ago · next one opens with a warm-up',
      'Chapters 1/6 · Readiness: Building',
    ]);
    expect(card.action).toEqual({ label: 'Study', route: 'istqb' });
    expect(todayCard({ ...data, activeSession: { no: 4, steps: [], index: 0, answers: {} } }, course, OBJECTIVES).action.route).toBe('istqb/session');
    expect(todayCard(null, course, OBJECTIVES)).toBe(null);
  });

  it('home summary: chapters X/6, readiness, next step, warm-up note, wrong answers', async () => {
    setExtras({ objectives: OBJECTIVES, handled: [] });
    const el = await homeCards({}, course, data);
    document.body.replaceChildren(el);
    expect(el.querySelector('[data-testid="istqb-chapters"]').textContent).toBe('Chapters 1/6');
    expect(el.querySelector('[data-testid="istqb-readiness"]').textContent).toMatch(/Readiness: Building\. The gate: two full mocks in a row at 80 % or more \(none yet\)/);
    expect(el.querySelector('[data-testid="istqb-next"]').textContent).toBe('Next: session 4, Chapter 3 §3.1 Static testing basics');
    expect(el.querySelector('[data-testid="istqb-gap"]').textContent).toMatch(/warm-up/);
    expect(el.querySelector('[data-testid="istqb-review-link"]').textContent).toBe('Wrong answers (3)');
  });

  it('wrong answers newest first; a retry session uses questions on the same objectives', () => {
    expect(wrongAnswers(data).map((a) => a.questionId)).toEqual(['notion-s3-Q3', 'notion-s1-Q2', 'notion-s1-D1']);
    const withCh3 = { ...data, attempts: [...data.attempts, { questionId: 'q3.1.1-a', objective: 'FL-3.1.1', chosen: 'A', correct: false, at: '2026-10-17', sessionNo: 4, kind: 'quiz' }] };
    const retry = buildRetrySession(course, withCh3, { rng: fixedRng });
    expect(retry.steps).toEqual([{ type: 'drill', questionId: 'q3.1.1-a', label: 'Wrong-answer retry' }]);
    expect(retry.no).toBe(4);
  });

  it('progress summary lines', () => {
    expect(progressSummary(data)).toContain('Review items: 1');
  });
});
