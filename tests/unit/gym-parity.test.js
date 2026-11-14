// The Gym port must give the same answers as gainz-tracker for the same data: these tests run
// gainz-tracker's original functions (tests/fixtures/gainz-original.js, copied unchanged) side by
// side with the port, on generated workout histories and many "today"s.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gainzOriginal } from '../fixtures/gainz-original.js';
import {
  currentDayName, getStreak, getWeekKey, initExInputs, sessionsThisWeek, targetSessions, todayISO, todayProtein,
} from '../../src/modules/gym/logic.js';
import { WORKOUTS } from '../../src/modules/gym/program.js';

// A small seeded random generator, so every run tests the same histories.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A history of workouts between start and end (local dates), newest first, like gainz stores it. */
function history(seed, { start, end, density = 0.45, phase = 'phase1' }) {
  const rand = rng(seed);
  const days = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];
  const logs = [];
  let id = 1;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (rand() < density) {
      const n = rand() < 0.1 ? 2 : 1; // two sessions on one day happen
      for (let k = 0; k < n; k++) {
        const day = days[Math.floor(rand() * (phase === 'phase2' ? 4 : 3))];
        logs.unshift({
          id: id++,
          date: iso(d),
          day,
          mode: rand() < 0.2 ? 'home' : 'gym',
          exercises: [{ name: WORKOUTS[day].exercises[0].name, sets: [{ weight: Math.round(rand() * 80), reps: 8 + Math.floor(rand() * 5) }] }],
        });
      }
    }
  }
  return logs;
}

function stateFor(logs, phase = 'phase1') {
  return { workoutLogs: logs, phase, proteinLogs: {}, personalBests: {}, bodyweight: 75, checkIns: [], myFoods: [], dayIndex: logs.length, lastSeenStage: 0 };
}

afterEach(() => vi.useRealTimers());

// "Now"s that cover a Monday, a Sunday, mid-week, a year boundary, late evening and just after midnight.
const NOWS = [
  '2026-01-05T09:00:00', // Monday
  '2026-01-11T21:30:00', // Sunday evening
  '2026-01-14T12:00:00', // Wednesday
  '2026-12-31T18:00:00', // year end (Thursday)
  '2027-01-03T10:00:00', // Sunday across the new year
  '2026-03-30T00:30:00', // just after midnight local, on the day summer time began
  '2026-10-25T23:45:00', // late on the day winter time began
  '2026-06-01T07:00:00', // Monday
];

describe('parity with gainz-tracker', () => {
  const streaks = new Set();
  const dayNames = new Set();
  for (const [i, nowText] of NOWS.entries()) {
    for (const phase of ['phase1', 'phase2']) {
      it(`streak, day and sessions this week match at ${nowText} (${phase})`, () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const now = new Date(nowText);
        vi.setSystemTime(now);
        for (let seed = 1; seed <= 12; seed++) {
          const end = new Date(now);
          const start = new Date(now);
          start.setDate(start.getDate() - 120);
          const logs = history(seed * 31 + i, { start, end, density: [0.2, 0.45, 0.7][seed % 3], phase });
          const state = stateFor(logs, phase);
          const original = gainzOriginal(structuredClone(state));
          expect(getStreak(state, new Date()), `seed ${seed}`).toBe(original.getStreak());
          expect(currentDayName(state, new Date()), `seed ${seed}`).toBe(original.getCurrentDayName());
          expect(sessionsThisWeek(state, new Date()), `seed ${seed}`).toBe(original.getSessionsThisWeek());
          expect(targetSessions(state)).toBe(original.getTargetSessions());
          expect(todayISO(new Date())).toBe(original.today());
          streaks.add(original.getStreak());
          dayNames.add(original.getCurrentDayName());
        }
      });
    }
  }

  it('the generated histories exercise real streaks and every day of the cycle (the tests above are not empty)', () => {
    expect(Math.max(...streaks)).toBeGreaterThan(1);
    expect([...dayNames].sort()).toEqual(['Lower A', 'Lower B', 'Upper A', 'Upper B']);
  });

  it('a streak of perfect weeks counts up to the 52-week cap, like gainz', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-16T12:00:00'));
    const logs = [];
    for (let w = 0; w < 60; w++) {
      for (const dow of [0, 2, 4]) {
        const d = new Date('2026-09-14T12:00:00'); // a Monday
        d.setDate(d.getDate() - 7 * w + dow);
        logs.unshift({ id: logs.length + 1, date: iso(d), day: 'Upper A', mode: 'gym', exercises: [{ name: 'x', sets: [] }] });
      }
    }
    const state = stateFor(logs);
    expect(getStreak(state, new Date())).toBe(gainzOriginal(state).getStreak());
    expect(getStreak(state, new Date())).toBe(52);
  });

  // The Fighter's stages are TheHub's own since 2026-11-14 (Season 1 of the story): see gym-fighter.test.js.

  it('week keys match', () => {
    const original = gainzOriginal(stateFor([]));
    for (const d = new Date('2025-12-20T12:00:00'); d < new Date('2027-01-15T12:00:00'); d.setDate(d.getDate() + 1)) {
      expect(getWeekKey(iso(d))).toBe(original.getWeekKey(iso(d)));
    }
  });

  it("today's protein and the set pre-fill match", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-07T15:00:00Z'));
    const logs = history(7, { start: new Date('2025-12-01T12:00:00'), end: new Date('2026-01-06T12:00:00') });
    const state = { ...stateFor(logs), proteinLogs: { '2026-01-07': [{ name: 'a', grams: 25 }, { name: 'b', grams: 40 }], '2026-01-06': [{ name: 'c', grams: 99 }] } };
    const original = gainzOriginal(structuredClone(state));
    expect(todayProtein(state, new Date())).toBe(original.getTodayProtein());
    for (const day of Object.keys(WORKOUTS)) {
      for (const ex of WORKOUTS[day].exercises) {
        expect(initExInputs(state, ex, day)).toEqual(original.initExInputs(ex, day));
      }
    }
  });
});
