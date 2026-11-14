// Ladder exercises: one movement from easier to harder steps; each session records its step.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import gym from '../../src/modules/gym/index.js';
import { defaultData, validate } from '../../src/modules/gym/data.js';
import { currentStep, ladderOf, logWorkout, pbKey, readyToMoveUp, stepName, topOfRange } from '../../src/modules/gym/logic.js';
import { HOME_PLAN, LADDERS } from '../../src/modules/gym/program.js';
import { resetScreenState } from '../../src/modules/gym/screens.js';

const WED = new Date('2026-01-07T10:00:00Z');
const home = (extra = {}) => ({ ...defaultData(), program: 'home', ...extra });
const pushups = HOME_PLAN['Day A'].exercises.find((ex) => ex.name === 'Push-up ladder');
const done = (date, step, reps, name = 'Push-up ladder') => ({
  id: Date.parse(date), date, day: 'Day A', mode: 'home',
  exercises: [{ name, step, sets: reps.map((r) => ({ weight: 0, reps: r })) }],
});
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the ladders', () => {
  it('push-ups, pike push-ups and chair dips are ladders; push-ups start past the regular push-up', () => {
    const ladderNames = Object.values(HOME_PLAN).flatMap((d) => d.exercises).filter((ex) => ex.ladder).map((ex) => ex.name);
    expect(ladderNames).toEqual(['Push-up ladder', 'Pike push-up ladder', 'Chair dip ladder']);
    expect(stepName(pushups, LADDERS.push.start)).toBe('Deficit push-up (hands on the dumbbells)');
    for (const l of Object.values(LADDERS)) expect(l.start).toBeLessThanOrEqual(l.steps.length);
    expect(ladderOf(HOME_PLAN['Day A'].exercises[1])).toBeNull(); // the row is not a ladder
  });

  it('the current step is the last session\'s, or the start', () => {
    expect(currentStep(home(), pushups)).toBe(3);
    expect(currentStep(home({ workoutLogs: [done('2026-01-05', 4, [6, 6, 5])] }), pushups)).toBe(4);
    expect(currentStep(home({ workoutLogs: [done('2026-01-05', 99, [6])] }), pushups)).toBe(6); // clamped
  });

  it('the top of a rep range', () => {
    expect(['5–8', '12', '8–12/side', '30–60s'].map(topOfRange)).toEqual([8, 12, 12, 60]);
  });

  it('time to move up only when every set reached the top, at this step', () => {
    expect(readyToMoveUp(home({ workoutLogs: [done('2026-01-05', 3, [8, 8, 9])] }), pushups, 3)).toBe(true);
    expect(readyToMoveUp(home({ workoutLogs: [done('2026-01-05', 3, [8, 8, 7])] }), pushups, 3)).toBe(false);
    expect(readyToMoveUp(home({ workoutLogs: [done('2026-01-05', 3, [8, 8])] }), pushups, 3)).toBe(false); // a set missing
    expect(readyToMoveUp(home({ workoutLogs: [done('2026-01-05', 2, [8, 8, 8])] }), pushups, 3)).toBe(false);
    expect(readyToMoveUp(home({ workoutLogs: [done('2026-01-05', 6, [8, 8, 8])] }), pushups, 6)).toBe(false); // the top step
    expect(readyToMoveUp(home(), pushups, 3)).toBe(false);
  });

  it('logs the step with the session, and keeps personal bests per step', () => {
    const r = logWorkout(home(), {
      dayName: 'Day A', mode: 'home', now: WED, steps: { 'Push-up ladder': 4 },
      inputs: { 'Push-up ladder': [{ weight: '', reps: '6' }], Plank: [{ weight: '', reps: '45' }] },
    });
    expect(r.log.exercises).toEqual([
      { name: 'Push-up ladder', step: 4, sets: [{ weight: 0, reps: 6 }] },
      { name: 'Plank', sets: [{ weight: 0, reps: 45 }] },
    ]);
    expect(r.data.personalBests[pbKey('Push-up ladder', 4)]).toEqual({ weight: 0, reps: 6 });
    expect(r.data.personalBests.Plank).toEqual({ weight: 0, reps: 45 });
    expect(validate(r.data)).toEqual([]);
  });

  it('refuses a step below 1', () => {
    expect(validate(home({ workoutLogs: [done('2026-01-05', 0, [5])] }))).toContain('workout 1, Push-up ladder: the ladder step must be 1 or more');
  });
});

describe('the step picker on the Workout screen', () => {
  beforeEach(() => {
    resetScreenState();
    document.body.replaceChildren();
  });

  function mountWorkout(data) {
    const root = document.createElement('main');
    document.body.append(root);
    const saved = [];
    gym.routes['']({ root, data, readOnly: false, save: vi.fn(async (d) => saved.push(d)), navigate: vi.fn() });
    return { root, saved };
  }

  it('shows the step, changes it with + and −, and logs the chosen step', async () => {
    const { root, saved } = mountWorkout(home());
    const picker = () => root.querySelector('[data-testid="gym-step-push"]');
    expect(picker().textContent).toContain('Ladder step 3 of 6');
    expect(picker().textContent).toContain('Deficit push-up (hands on the dumbbells)');
    picker().querySelector('[aria-label="Harder step"]').click();
    expect(picker().textContent).toContain('Feet-raised push-up (feet on a chair)');

    const reps = root.querySelector('[data-testid="set-0-0-reps"]');
    reps.value = '6';
    reps.dispatchEvent(new Event('input'));
    root.querySelector('[data-testid="gym-log-workout"]').click();
    await flush();
    expect(saved[0].workoutLogs[0].exercises[0]).toEqual({ name: 'Push-up ladder', step: 4, sets: [{ weight: 0, reps: 6 }] });
  });

  it('suggests moving up after a session at the top of the range, and not otherwise', () => {
    const ready = mountWorkout(home({ workoutLogs: [done('2025-12-29', 3, [8, 8, 8])] })).root;
    expect(ready.querySelector('[data-testid="gym-step-up"]').textContent).toBe(
      '⬆ Last time every set reached the top of the range. Move up to step 4: Feet-raised push-up (feet on a chair)?',
    );
    document.body.replaceChildren();
    const notYet = mountWorkout(home({ workoutLogs: [done('2025-12-29', 3, [8, 7, 6])] })).root;
    expect(notYet.querySelector('[data-testid="gym-step-up"]')).toBeNull();
  });
});
