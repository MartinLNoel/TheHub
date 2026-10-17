// Q-18: study sessions and mocks are dated with the LOCAL calendar date, and compared with it.
// The clock is pinned to 00:30 Dutch summer time on 18 October 2026 (22:30 UTC on the 17th), the
// hour where a UTC date and the local date disagree.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultProgress } from '../../src/core/study/progress.js';
import { advance, answerStep, buildSession, currentStep, finishSession } from '../../src/core/study/session.js';
import { finishMock, startMock } from '../../src/core/study/mock.js';
import { checkCourse } from '../../src/core/study/content.js';
import { daysSinceLastSession } from '../../src/modules/istqb/rules.js';
import { addDays, daysBetween, localDate } from '../../src/core/dates.js';
import { exportFileName } from '../../src/core/transfer.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'sample-course');
const read = (n) => JSON.parse(readFileSync(join(DIR, `${n}.json`), 'utf8'));
const course = checkCourse({ lessons: read('lessons'), questions: read('questions'), cards: read('cards') }).course;
const Q = (id) => course.questions.find((q) => q.id === id);

const AFTER_MIDNIGHT = new Date('2026-10-17T22:30:00Z'); // 00:30 on 18 October in Amsterdam
let savedTZ;
beforeAll(() => {
  savedTZ = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
});
afterAll(() => {
  if (savedTZ === undefined) delete process.env.TZ;
  else process.env.TZ = savedTZ;
});

describe('Q-18: local calendar dates just after local midnight', () => {
  it('the timezone is really pinned (guards the test itself)', () => {
    expect(AFTER_MIDNIGHT.getDate()).toBe(18);
  });

  it('a lesson session finished at 00:30 is dated that local day and is "today"', () => {
    let p = { ...defaultProgress(), activeSession: buildSession(course, defaultProgress(), { rng: () => 0 }) };
    p = advance(p, course);
    while (currentStep(p.activeSession)) p = advance(answerStep(p, course, Q(currentStep(p.activeSession).questionId).answer), course);
    const { progress } = finishSession(p, course, { now: AFTER_MIDNIGHT });
    expect(progress.sessions.at(-1).date).toBe('2026-10-18');
    expect(daysSinceLastSession(progress, AFTER_MIDNIGHT)).toBe(0);
  });

  it('a mock finished at 00:30 is dated that local day', () => {
    const t = AFTER_MIDNIGHT.getTime();
    const config = { id: 'quick', label: 'Quick mock', kind: 'mini-mock', count: 3, minutes: 5 };
    const p = { ...defaultProgress(), activeMock: startMock(course, defaultProgress(), config, { now: t - 60_000, rng: () => 0 }) };
    const { progress } = finishMock(p, course, { now: t });
    expect(progress.sessions.at(-1).date).toBe('2026-10-18');
    expect(daysSinceLastSession(progress, AFTER_MIDNIGHT)).toBe(0);
  });
});

describe('core date helpers (src/core/dates.js)', () => {
  it('localDate is the local day, not the UTC one', () => {
    expect(localDate(AFTER_MIDNIGHT)).toBe('2026-10-18');
    expect(AFTER_MIDNIGHT.toISOString().slice(0, 10)).toBe('2026-10-17'); // what the old code stored
    expect(exportFileName(AFTER_MIDNIGHT)).toBe('thehub-export-2026-10-18.json');
  });

  it('addDays and daysBetween survive month ends and daylight-saving changes', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26'); // clocks go back on 25 October
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29'); // clocks go forward on 28 March
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2);
    expect(daysBetween('2026-10-18', '2026-10-08')).toBe(-10);
    expect(daysBetween('2026-10-18T00:30:00', '2026-10-18')).toBe(0);
  });
});
