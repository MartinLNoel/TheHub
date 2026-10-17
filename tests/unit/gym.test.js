// Gym module: contract, data, validate, the logging rules and the Today card.
import { describe, expect, it } from 'vitest';
import gym, { todayCard } from '../../src/modules/gym/index.js';
import { defaultData, isISODate, validate } from '../../src/modules/gym/data.js';
import {
  addCheckIn, addMyFood, addProtein, checkinThisWeek, deleteMyFood, logWorkout, removeProtein, sessionsUntilPhase2, setBodyweight, upgradePhase,
} from '../../src/modules/gym/logic.js';
import { checkModule } from '../../src/core/registry.js';
import { HOME_WORKOUTS, PROGRAM, QUICK_FOODS, STAGES, WORKOUTS } from '../../src/modules/gym/program.js';
import { getCharacterSVG } from '../../src/modules/gym/fighter.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const WED = new Date('2026-01-07T10:00:00Z');

function withLogs(...logs) {
  return { ...defaultData(), workoutLogs: logs };
}
const log = (date, day = 'Upper A', extra = {}) => ({ id: Date.parse(date), date, day, mode: 'gym', exercises: [{ name: 'Lat Pulldown', sets: [{ weight: 40, reps: 10 }] }], ...extra });

describe('module contract', () => {
  it('passes the registry checks', () => {
    expect(checkModule(gym)).toEqual([]);
  });

  it('has every screen, and the "Log workout" shortcut route', () => {
    expect(Object.keys(gym.routes).sort()).toEqual(['', 'checkin', 'fighter', 'history', 'log', 'protein']);
    const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
    const shortcut = manifest.shortcuts.find((s) => s.name === 'Log workout');
    expect(shortcut.url).toBe('./#/gym/log');
    expect(typeof gym.routes.log).toBe('function');
  });

  it('a fresh store is valid', () => {
    expect(validate(defaultData())).toEqual([]);
  });
});

describe('program data is identical to gainz-tracker', () => {
  // Compare against the constants in gainz-tracker's app.js, when it is on this PC.
  const gainzPath = join(ROOT, '..', 'gainz-tracker', 'app.js');
  let src = null;
  try {
    src = readFileSync(gainzPath, 'utf8');
  } catch {
    src = null;
  }
  const grab = (name, open, close) => {
    const i = src.indexOf(`const ${name} = ${open}`);
    const j = src.indexOf(`\n${close};`, i);
    // eslint-disable-next-line no-new-func
    return new Function(`return ${src.slice(i + `const ${name} = `.length, j + 2)}`)();
  };
  it.skipIf(!src)('PROGRAM, WORKOUTS, HOME_WORKOUTS, QUICK_FOODS, STAGES', () => {
    const s = src.replace(/\r\n/g, '\n');
    src = s;
    expect(PROGRAM).toEqual(grab('PROGRAM', '{', '}'));
    expect(WORKOUTS).toEqual(grab('WORKOUTS', '{', '}'));
    expect(HOME_WORKOUTS).toEqual(grab('HOME_WORKOUTS', '{', '}'));
    expect(QUICK_FOODS).toEqual(grab('QUICK_FOODS', '[', ']'));
    expect(STAGES).toEqual(grab('STAGES', '[', ']'));
  });

  it('has 10 stages and an SVG character for each', () => {
    expect(STAGES).toHaveLength(10);
    for (const st of STAGES) {
      const svg = getCharacterSVG(st.id, st.id % 2 === 0);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('viewBox="0 0 200 260"');
    }
  });
});

describe('validate', () => {
  it('needs a date and exercises on every workout', () => {
    expect(validate(withLogs(log('2026-01-05')))).toEqual([]);
    expect(validate(withLogs({ ...log('2026-01-05'), date: undefined })).join()).toMatch(/no valid date/);
    expect(validate(withLogs({ ...log('2026-01-05'), exercises: [] })).join()).toMatch(/no exercises/);
    expect(validate(withLogs({ ...log('2026-01-05'), exercises: undefined })).join()).toMatch(/no exercises/);
  });

  it('refuses dates that do not parse', () => {
    for (const bad of ['2026-02-30', '05-01-2026', 'yesterday', '2026-1-5']) {
      expect(isISODate(bad), bad).toBe(false);
      expect(validate(withLogs(log(bad))).join(), bad).toMatch(/no valid date/);
    }
    expect(validate({ ...defaultData(), proteinLogs: { 'not-a-day': [] } }).join()).toMatch(/not a date/);
    expect(validate({ ...defaultData(), checkIns: [{ date: '2026-13-01', weight: 70, cals: null, notes: '' }] }).join()).toMatch(/no valid date/);
  });

  it('refuses negative counts', () => {
    expect(validate(withLogs(log('2026-01-05', 'Upper A', { exercises: [{ name: 'X', sets: [{ weight: -1, reps: 5 }] }] }))).join()).toMatch(/0 or more/);
    expect(validate(withLogs(log('2026-01-05', 'Upper A', { exercises: [{ name: 'X', sets: [{ weight: 10, reps: -5 }] }] }))).join()).toMatch(/0 or more/);
    expect(validate({ ...defaultData(), proteinLogs: { '2026-01-05': [{ name: 'x', grams: -3 }] } }).join()).toMatch(/grams/);
    expect(validate({ ...defaultData(), checkIns: [{ date: '2026-01-05', weight: -70, cals: null, notes: '' }] }).join()).toMatch(/weight/);
    expect(validate({ ...defaultData(), checkIns: [{ date: '2026-01-05', weight: 70, cals: -1, notes: '' }] }).join()).toMatch(/calories/);
    expect(validate({ ...defaultData(), myFoods: [{ name: 'x', protein: -1 }] }).join()).toMatch(/saved food/);
    expect(validate({ ...defaultData(), personalBests: { X: { weight: -1, reps: 1 } } }).join()).toMatch(/personal bests/);
    expect(validate({ ...defaultData(), dayIndex: -1 }).join()).toMatch(/dayIndex/);
    expect(validate({ ...defaultData(), bodyweight: 0 }).join()).toMatch(/bodyweight/);
  });

  it('refuses a missing or broken store', () => {
    expect(validate(null)).not.toEqual([]);
    expect(validate({ ...defaultData(), workoutLogs: 'x' }).join()).toMatch(/list/);
    expect(validate({ ...defaultData(), phase: 'phase9' }).join()).toMatch(/phase/);
  });
});

describe('logging a workout (gainz saveWorkout)', () => {
  it('stores only the exercises with numbers, newest first, and updates personal bests', () => {
    const before = withLogs(log('2026-01-05'));
    const inputs = {
      'Incline Chest Press': [{ weight: '42.5', reps: '9' }, { weight: '', reps: '' }, { weight: '40', reps: '10' }],
      'Lat Pulldown': [{ weight: '', reps: '' }],
    };
    const r = logWorkout(before, { dayName: 'Upper A', mode: 'gym', inputs, now: WED, id: 99 });
    expect(r.error).toBeUndefined();
    expect(r.data.workoutLogs[0]).toEqual({
      id: 99, date: '2026-01-07', day: 'Upper A', mode: 'gym',
      exercises: [{ name: 'Incline Chest Press', sets: [{ weight: 42.5, reps: 9 }, { weight: 40, reps: 10 }] }],
    });
    expect(r.data.personalBests['Incline Chest Press']).toEqual({ weight: 42.5, reps: 9 });
    expect(r.data.dayIndex).toBe(1);
    expect(before.workoutLogs).toHaveLength(1); // the input is not changed
  });

  it('same weight with more reps is a new personal best; less is not', () => {
    const before = { ...defaultData(), personalBests: { 'Lat Pulldown': { weight: 40, reps: 10 } } };
    const more = logWorkout(before, { dayName: 'Upper A', mode: 'gym', inputs: { 'Lat Pulldown': [{ weight: 40, reps: 11 }] }, now: WED });
    expect(more.data.personalBests['Lat Pulldown']).toEqual({ weight: 40, reps: 11 });
    const less = logWorkout(before, { dayName: 'Upper A', mode: 'gym', inputs: { 'Lat Pulldown': [{ weight: 35, reps: 15 }] }, now: WED });
    expect(less.data.personalBests['Lat Pulldown']).toEqual({ weight: 40, reps: 10 });
  });

  it('refuses an empty workout', () => {
    expect(logWorkout(defaultData(), { dayName: 'Upper A', mode: 'gym', inputs: {}, now: WED }).error).toBe('LOG SOME WEIGHTS FIRST');
  });

  it('home mode logs the home exercises', () => {
    const r = logWorkout(defaultData(), { dayName: 'Lower A', mode: 'home', inputs: { Plank: [{ weight: 0, reps: 60 }] }, now: WED });
    expect(r.data.workoutLogs[0]).toMatchObject({ mode: 'home', day: 'Lower A', exercises: [{ name: 'Plank', sets: [{ weight: 0, reps: 60 }] }] });
  });

  it('reports a stage unlock at 5 sessions', () => {
    const four = withLogs(...['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map((d) => log(d)));
    const r = logWorkout(four, { dayName: 'Upper A', mode: 'gym', inputs: { 'Lat Pulldown': [{ weight: 1, reps: 1 }] }, now: WED });
    expect([r.oldStage.id, r.newStage.id]).toEqual([0, 1]);
  });

  it('phase 2 after 18 sessions', () => {
    const many = withLogs(...Array.from({ length: 17 }, (_, i) => log(`2025-11-${String(i + 1).padStart(2, '0')}`)));
    expect(sessionsUntilPhase2(many)).toBe(1);
    expect(sessionsUntilPhase2(withLogs(...many.workoutLogs, log('2025-11-20')))).toBe(0);
    expect(upgradePhase({ ...many, dayIndex: 17 })).toMatchObject({ phase: 'phase2', dayIndex: 0 });
  });
});

describe('protein, foods and check-ins', () => {
  it('adds and removes protein on today', () => {
    let d = addProtein(defaultData(), 'Whey shake', 25, WED);
    d = addProtein(d, 'Tuna can', 30, WED);
    expect(d.proteinLogs['2026-01-07']).toEqual([{ name: 'Whey shake', grams: 25 }, { name: 'Tuna can', grams: 30 }]);
    d = removeProtein(d, 0, WED);
    expect(d.proteinLogs['2026-01-07']).toEqual([{ name: 'Tuna can', grams: 30 }]);
  });

  it('saves and deletes my foods; bodyweight falls back to 75', () => {
    let d = addMyFood(defaultData(), 'Bar', 19);
    expect(d.myFoods.at(-1)).toEqual({ name: 'Bar', protein: 19 });
    d = deleteMyFood(d, d.myFoods.length - 1);
    expect(d.myFoods).toEqual(defaultData().myFoods);
    expect(setBodyweight(d, '80.5').bodyweight).toBe(80.5);
    expect(setBodyweight(d, '').bodyweight).toBe(75);
  });

  it('a check-in also sets the bodyweight', () => {
    const d = addCheckIn(defaultData(), { weight: 76.4, cals: null, notes: 'ok' }, WED);
    expect(d.checkIns).toEqual([{ date: '2026-01-07', weight: 76.4, cals: null, notes: 'ok' }]);
    expect(d.bodyweight).toBe(76.4);
    expect(validate(d)).toEqual([]);
  });

  it('Check-in "This Week" counts from Sunday, as in gainz', () => {
    const d = withLogs(log('2026-01-04'), log('2026-01-05'), log('2026-01-03'));
    expect(checkinThisWeek(d, new Date('2026-01-07T12:00:00'))).toBeGreaterThanOrEqual(1);
  });
});

describe('Today card', () => {
  it('fresh: Upper A, 0/3, all protein left, no streak, one tap to log', () => {
    const card = todayCard(defaultData(), WED);
    expect(card.lines).toEqual(['Today: Upper A — Push + Pull', 'This week: 0/3 sessions', 'Protein: 135g left today', 'Streak: 0 weeks']);
    expect(card.action).toEqual({ label: 'Log workout', route: 'gym/log' });
  });

  it('after a session today: done, next day, protein left', () => {
    const d = addProtein(withLogs(log('2026-01-07')), 'Whey shake', 25, WED);
    const card = todayCard(d, WED);
    expect(card.lines[0]).toBe('Done today. Next: Lower A — Quad + Hamstring.');
    expect(card.lines[1]).toBe('This week: 1/3 sessions');
    expect(card.lines[2]).toBe('Protein: 110g left today');
  });

  it("rest day once the week's target is met, and the streak counts it", () => {
    const d = withLogs(log('2026-01-07', 'Upper B'), log('2026-01-06', 'Lower A'), log('2026-01-05', 'Upper A'));
    const card = todayCard(d, new Date('2026-01-08T10:00:00Z'));
    expect(card.lines[0]).toMatch(/^Rest day/);
    expect(card.lines[1]).toBe('This week: 3/3 sessions');
    expect(card.lines[3]).toBe('Streak: 1 week 🔥');
  });
});
