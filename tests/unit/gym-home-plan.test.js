// The Gym's home plan: the program switch (schema 2), Day A/B/C and their rules.
import { describe, expect, it } from 'vitest';
import gym, { todayCard } from '../../src/modules/gym/index.js';
import { SCHEMA_VERSION, defaultData, migrations, validate } from '../../src/modules/gym/data.js';
import { mapGainzState, mergeGainz } from '../../src/modules/gym/import.js';
import {
  activeProgram, currentDayName, isHomePlan, logWorkout, setProgram, targetSessions, workoutFor,
} from '../../src/modules/gym/logic.js';
import { HOME_PLAN, HOME_PROGRAM, PROGRAM } from '../../src/modules/gym/program.js';
import { runMigrations } from '../../src/core/db.js';

const WED = new Date('2026-01-07T10:00:00Z'); // Monday is 2026-01-05
const home = (extra = {}) => ({ ...defaultData(), program: 'home', ...extra });
const log = (date, day, mode = 'home') => ({ id: Date.parse(date), date, day, mode, exercises: [{ name: 'Dumbbell curl', sets: [{ weight: 7, reps: 10 }] }] });

describe('the plan data', () => {
  const all = Object.values(HOME_PLAN).flatMap((d) => d.exercises);

  it('has Day A, B and C, three sets each, a main block then the add-on', () => {
    expect(HOME_PROGRAM.days).toEqual(Object.keys(HOME_PLAN));
    for (const day of HOME_PROGRAM.days) {
      const parts = HOME_PLAN[day].exercises.map((ex) => ex.part);
      expect(parts).toEqual([...Array(7).fill('main'), ...Array(3).fill('add')]);
    }
    expect(all.every((ex) => ex.sets === 3 && ex.name && ex.reps && ex.muscle && ex.demo)).toBe(true);
  });

  it('every day is full body: legs (two moves and a calf raise), core and lower abs, not only the upper body', () => {
    for (const day of HOME_PROGRAM.days) {
      const muscles = HOME_PLAN[day].exercises.map((ex) => ex.muscle);
      const legMoves = muscles.filter((m) => ['Legs', 'Glutes', 'Hamstrings'].includes(m));
      expect(legMoves, day).toHaveLength(2);
      expect(muscles, day).toEqual(expect.arrayContaining(['Calves', 'Core', 'Lower abs']));
    }
  });

  it('no band or towel is needed, and no exercise jumps', () => {
    expect(JSON.stringify(HOME_PLAN)).not.toMatch(/band|towel|jump/i);
  });

  it('starting loads are only settings the plates allow (2 × 1.25 and 2 × 2.5 per side at most)', () => {
    const allowed = /^(Both DBs|One DB) · (1\.25|2\.5|2\.5 \+ 1\.25|2\.5 \+ 2\.5) each side$/i;
    for (const ex of all.filter((e) => e.load)) {
      const load = ex.load.replace(/^Bodyweight first, then /, '');
      expect(load, ex.name).toMatch(allowed);
      if (load.startsWith('Both DBs')) expect(load, `${ex.name}: a pair cannot both have two 2.5s per side`).not.toContain('2.5 + 2.5');
    }
  });
});

describe('schema 2: the program field', () => {
  it('is version 2, and a fresh store is on the gym program and valid', () => {
    expect(SCHEMA_VERSION).toBe(2);
    expect(gym.schemaVersion).toBe(2);
    expect(defaultData().program).toBe('gym');
    expect(validate(defaultData())).toEqual([]);
    expect(validate(home())).toEqual([]);
  });

  it('migrates version 1 data to the gym program, changing nothing else', () => {
    const v1 = { ...defaultData(), phase: 'phase2', workoutLogs: [log('2026-01-05', 'Upper A', 'gym')] };
    delete v1.program;
    expect(validate(v1)).toContain('unknown program "undefined"');
    const v2 = runMigrations(v1, 1, 2, gym.migrations);
    expect(v2).toEqual({ ...v1, program: 'gym' });
    expect(validate(v2)).toEqual([]);
    expect(v1.program).toBeUndefined(); // the input is untouched
    expect(gym.migrations).toBe(migrations);
  });

  it('refuses an unknown program', () => {
    expect(validate({ ...defaultData(), program: 'park' })).toContain('unknown program "park"');
  });
});

describe('the rules on the home plan', () => {
  it('3 sessions a week; Monday starts at Day A, then B, then C', () => {
    expect(targetSessions(home())).toBe(3);
    expect(targetSessions(home({ phase: 'phase2' }))).toBe(3); // the gym phase does not apply at home
    expect(activeProgram(home())).toBe(HOME_PROGRAM);
    expect(activeProgram(defaultData())).toBe(PROGRAM.phase1);
    expect(currentDayName(home(), WED)).toBe('Day A');
    expect(currentDayName(home({ workoutLogs: [log('2026-01-05', 'Day A')] }), WED)).toBe('Day B');
    expect(currentDayName(home({ workoutLogs: [log('2026-01-06', 'Day B'), log('2026-01-05', 'Day A')] }), WED)).toBe('Day C');
    expect(currentDayName(home({ workoutLogs: [log('2025-12-31', 'Day B')] }), WED)).toBe('Day A'); // last week's
  });

  it('switching mid-week starts the new program at its first day; sessions still count', () => {
    const data = home({ workoutLogs: [log('2026-01-05', 'Upper A', 'gym')] });
    expect(currentDayName(data, WED)).toBe('Day A');
    expect(currentDayName(setProgram(data, 'gym'), WED)).toBe('Lower A');
  });

  it('setProgram keeps the phase and history', () => {
    const data = { ...defaultData(), phase: 'phase2', workoutLogs: [log('2026-01-05', 'Upper A', 'gym')] };
    const switched = setProgram(data, 'home');
    expect(isHomePlan(switched)).toBe(true);
    expect(switched.phase).toBe('phase2');
    expect(switched.workoutLogs).toEqual(data.workoutLogs);
    expect(setProgram(switched, 'anything else').program).toBe('gym');
  });

  it('a home-plan day has one version, whatever the mode', () => {
    expect(workoutFor('Day B', 'gym')).toBe(HOME_PLAN['Day B']);
    expect(workoutFor('Day B', 'home')).toBe(HOME_PLAN['Day B']);
    expect(workoutFor('Upper A', 'gym').focus).toBe('Push + Pull'); // the gym program is unchanged
  });

  it('logs a home-plan day with its exercises and personal bests', () => {
    const r = logWorkout(home(), {
      dayName: 'Day A', mode: 'home', now: WED,
      inputs: { 'Dumbbell curl': [{ weight: '7', reps: '12' }], 'Push-up ladder': [{ weight: '', reps: '8' }], 'Not in the plan': [{ weight: 1, reps: 1 }] },
    });
    expect(r.log).toMatchObject({ date: '2026-01-07', day: 'Day A', mode: 'home' });
    expect(r.log.exercises.map((e) => e.name)).toEqual(['Push-up ladder', 'Dumbbell curl']);
    expect(r.data.personalBests['Push-up ladder']).toEqual({ weight: 0, reps: 8 });
    expect(validate(r.data)).toEqual([]);
  });

  it("the Today card shows the home plan's day", () => {
    const card = todayCard(home(), WED);
    expect(card.lines[0]).toBe('Today: Day A — Push emphasis');
    expect(card.lines[1]).toBe('This week: 0/3 sessions');
    expect(todayCard(home({ workoutLogs: [log('2026-01-07', 'Day A')] }), WED).lines[0]).toBe('Done today. Next: Day B — Shoulders + width.');
  });
});

describe('the gainz-tracker import and the program', () => {
  const raw = { workoutLogs: [log('2026-01-05', 'Upper A', 'gym')], phase: 'phase1' };

  it('gainz data is the gym program', () => {
    expect(mapGainzState(raw).program).toBe('gym');
    expect(validate(mapGainzState(raw))).toEqual([]);
  });

  it('importing keeps the program already chosen', () => {
    expect(mergeGainz(home(), mapGainzState(raw)).data.program).toBe('home');
    expect(mergeGainz(home({ workoutLogs: [log('2026-01-06', 'Day A')] }), mapGainzState(raw)).data.program).toBe('home');
  });
});
