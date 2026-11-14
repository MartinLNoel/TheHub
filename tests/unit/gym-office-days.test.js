// Office days (Gym schema 3): rest days the week works around, changeable per week, never blocking a session.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gym, { todayCard } from '../../src/modules/gym/index.js';
import { DEFAULT_OFFICE_DAYS, SCHEMA_VERSION, defaultData, validate } from '../../src/modules/gym/data.js';
import { getWeekKey, logWorkout, officeDaysFor, toggleOfficeDay, weekStatus, weekdayOf } from '../../src/modules/gym/logic.js';
import { resetScreenState } from '../../src/modules/gym/screens.js';
import { runMigrations } from '../../src/core/db.js';

// The week of Monday 2026-01-05 to Sunday 2026-01-11.
const at = (date) => new Date(`${date}T10:00:00Z`);
const MON = at('2026-01-05');
const TUE = at('2026-01-06');
const WED = at('2026-01-07');
const FRI = at('2026-01-09');
const SAT = at('2026-01-10');
const WEEK = getWeekKey('2026-01-07');
const home = (extra = {}) => ({ ...defaultData(), program: 'home', ...extra });
const log = (date, day = 'Day A') => ({ id: Date.parse(date), date, day, mode: 'home', exercises: [{ name: 'Plank', sets: [{ weight: 0, reps: 40 }] }] });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('schema 3', () => {
  it('a fresh store has Tuesday and Thursday as office days, and is valid', () => {
    expect(SCHEMA_VERSION).toBe(3);
    expect(DEFAULT_OFFICE_DAYS).toEqual([2, 4]);
    expect(defaultData()).toMatchObject({ officeDays: [2, 4], officeWeeks: {} });
    expect(validate(defaultData())).toEqual([]);
  });

  it('migrates version 2 data, changing nothing else', () => {
    const v2 = { ...home(), workoutLogs: [log('2026-01-05')] };
    delete v2.officeDays;
    delete v2.officeWeeks;
    const v3 = runMigrations(v2, 2, 3, gym.migrations);
    expect(v3).toEqual({ ...v2, officeDays: [2, 4], officeWeeks: {} });
    expect(validate(v3)).toEqual([]);
    const v1 = { ...v2 };
    delete v1.program;
    expect(validate(runMigrations(v1, 1, 3, gym.migrations))).toEqual([]); // from version 1 as well
  });

  it('refuses days that are not weekdays, repeats and broken week keys', () => {
    expect(validate({ ...defaultData(), officeDays: [0] })).toContain('officeDays must be a list of weekdays 1 to 7');
    expect(validate({ ...defaultData(), officeDays: [2, 2] })).toContain('officeDays must be a list of weekdays 1 to 7');
    expect(validate({ ...defaultData(), officeWeeks: { 'next week': [1] } })).toContain('office week "next week" is not a week');
    expect(validate({ ...defaultData(), officeWeeks: [] })).toContain('officeWeeks must be an object of weeks');
  });
});

describe('the rules', () => {
  it('weekdays run from 1 (Monday) to 7 (Sunday)', () => {
    expect(['2026-01-05', '2026-01-06', '2026-01-11'].map(weekdayOf)).toEqual([1, 2, 7]);
  });

  it('changing a week leaves the usual days and other weeks alone', () => {
    const data = toggleOfficeDay(toggleOfficeDay(home(), WEEK, 4), WEEK, 3); // Thursday off, Wednesday on
    expect(officeDaysFor(data, WEEK)).toEqual([2, 3]);
    expect(data.officeDays).toEqual([2, 4]);
    expect(officeDaysFor(data, getWeekKey('2026-01-14'))).toEqual([2, 4]);
    expect(validate(data)).toEqual([]);
  });

  it('a fresh week from Monday: 3 sessions, 5 free days, no warning', () => {
    const w = weekStatus(home(), MON);
    expect(w.days.map((d) => d.date)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11']);
    expect(w.days.filter((d) => d.office).map((d) => d.label)).toEqual(['Tu', 'Th']);
    expect(w).toMatchObject({ left: 3, freeLeft: 5, warning: null, officeToday: false });
  });

  it('weekends count as training days', () => {
    expect(weekStatus(home(), SAT)).toMatchObject({ left: 3, freeLeft: 2 }); // Saturday and Sunday
  });

  it('warns when the free days left are no more than the sessions left', () => {
    const oneDone = home({ workoutLogs: [log('2026-01-05')] });
    expect(weekStatus(oneDone, FRI).warning).toBeNull(); // 2 left, Friday to Sunday free
    expect(weekStatus(oneDone, SAT).warning).toBe('⚠ 2 sessions left, 2 free days: no room to skip.');
    expect(weekStatus(home(), SAT).warning).toBe('⚠ 3 sessions left, 2 free days: an office day will have to count.');
  });

  it('today stops being free once trained; office days and trained days show', () => {
    const w = weekStatus(home({ workoutLogs: [log('2026-01-07'), log('2026-01-06')] }), WED);
    expect(w.trainedToday).toBe(true);
    expect(w.freeLeft).toBe(3); // Friday, Saturday, Sunday
    expect(w.days[1]).toMatchObject({ label: 'Tu', office: true, trained: 1, past: true });
  });

  it('an office day never blocks logging a session', () => {
    expect(weekStatus(home(), TUE).officeToday).toBe(true);
    const r = logWorkout(home(), { dayName: 'Day A', mode: 'home', now: TUE, inputs: { Plank: [{ weight: '', reps: '45' }] } });
    expect(r.error).toBeUndefined();
    expect(r.log.date).toBe('2026-01-06');
  });
});

describe('the Today card', () => {
  it('on an office day: rest, and an extra session still counts', () => {
    const card = todayCard(home(), TUE);
    expect(card.lines[0]).toBe('Today: Day A — Push emphasis'); // the plan stays first, on any day
    expect(card.lines).toContain('🏢 Office day: rest. An extra session still counts.');
  });

  it('adds the warning when the week is tight, and nothing extra on a normal day', () => {
    expect(todayCard(home(), SAT).lines.at(-1)).toBe('⚠ 3 sessions left, 2 free days: an office day will have to count.');
    expect(todayCard(home(), WED).lines).toHaveLength(4);
  });
});

describe('the week card on the Workout screen', () => {
  beforeEach(() => {
    resetScreenState();
    document.body.replaceChildren();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(WED);
  });
  afterEach(() => vi.useRealTimers());

  function mountWorkout(data) {
    const root = document.createElement('main');
    document.body.append(root);
    const saved = [];
    gym.routes['']({ root, data, readOnly: false, save: vi.fn(async (d) => saved.push(d)), navigate: vi.fn() });
    return { root, saved };
  }

  it('shows the 7 days, the office days, and what is left', () => {
    const { root } = mountWorkout(home({ workoutLogs: [log('2026-01-05')] }));
    const days = [...root.querySelectorAll('.gym-wd')];
    expect(days.map((d) => d.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'true', 'false', 'false', 'false']);
    expect(days[0].textContent).toBe('Mo✓');
    expect(days[0].disabled).toBe(true); // past
    expect(days[2].className).toContain('is-today');
    expect(root.querySelector('[data-testid="gym-week-left"]').textContent).toBe('2 left · 4 free days left');
  });

  it('tapping a day marks it as an office day for this week only', async () => {
    const { root, saved } = mountWorkout(home());
    root.querySelector('[data-testid="wd-5"]').click(); // Friday
    await flush();
    expect(saved).toHaveLength(1);
    expect(officeDaysFor(saved[0], WEEK)).toEqual([2, 4, 5]);
    expect(saved[0].officeDays).toEqual([2, 4]);
    expect(root.querySelector('[data-testid="wd-5"]').getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-testid="gym-week-left"]').textContent).toBe('3 left · 3 free days left');
    expect(root.querySelector('[data-testid="gym-week-warning"]').textContent).toBe('⚠ 3 sessions left, 3 free days: no room to skip.');
  });
});
