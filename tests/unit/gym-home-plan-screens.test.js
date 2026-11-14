// The Workout screen on the home plan: the program switch and each exercise's demonstration.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import gym from '../../src/modules/gym/index.js';
import { defaultData } from '../../src/modules/gym/data.js';
import { HOME_PLAN } from '../../src/modules/gym/program.js';
import { resetScreenState } from '../../src/modules/gym/screens.js';

const home = (extra = {}) => ({ ...defaultData(), program: 'home', ...extra });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the Workout screen on the home plan', () => {
  beforeEach(() => {
    resetScreenState();
    document.body.replaceChildren();
  });

  function mountWorkout(data) {
    const root = document.createElement('main');
    document.body.append(root);
    const saved = [];
    const ctx = { root, data, readOnly: false, save: vi.fn(async (d) => saved.push(d)), navigate: vi.fn() };
    gym.routes[''](ctx);
    return { root, saved };
  }

  it("shows the day's exercises, each with its moving figure, cue and video link, in two blocks", () => {
    const { root } = mountWorkout(home());
    const day = HOME_PLAN['Day A'].exercises;
    expect(root.querySelector('[data-testid="gym-day"]').textContent).toBe('Day A');
    const figures = [...root.querySelectorAll('.gym-ex svg.gym-demo')];
    expect(figures.map((f) => f.dataset.demo)).toEqual(day.map((ex) => ex.demo));
    expect(root.querySelectorAll('.gym-ex__cue')).toHaveLength(day.length);
    expect(root.querySelectorAll('a.gym-ex__video[target="_blank"]')).toHaveLength(day.length);
    expect([...root.querySelectorAll('.gym-part')].map((p) => p.textContent)).toEqual(['Main block', 'Arm + shoulder add-on']);
    expect(root.querySelector('.gym-ex__load').textContent).toMatch(/^Start: /);
    expect(root.textContent).toContain('HOME PLAN · DAY 1 OF 3');
  });

  it('has no GYM/HOME version toggle and no Phase 2 prompt', () => {
    const { root } = mountWorkout(home());
    expect(root.querySelector('[data-testid="mode-gym"]')).toBeNull();
    expect(root.textContent).not.toContain('Phase 2');
  });

  it('the gym program shows no figures, as before', () => {
    const { root } = mountWorkout(defaultData());
    expect(root.querySelector('[data-testid="gym-day"]').textContent).toBe('Upper A');
    expect(root.querySelector('svg.gym-demo')).toBeNull();
    expect(root.querySelector('[data-testid="mode-home"]')).not.toBeNull();
  });

  it('the switch saves the program and shows the other one', async () => {
    const { root, saved } = mountWorkout(defaultData());
    expect(root.querySelector('[data-testid="program-gym"]').getAttribute('aria-pressed')).toBe('true');
    root.querySelector('[data-testid="program-home"]').click();
    await flush();
    expect(saved).toHaveLength(1);
    expect(saved[0].program).toBe('home');
    expect(root.querySelector('[data-testid="gym-day"]').textContent).toBe('Day A');
    expect(root.querySelector('[data-testid="program-home"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('logs the home-plan day as a home session', async () => {
    const { root, saved } = mountWorkout(home());
    const reps = root.querySelector('[data-testid="set-0-0-reps"]');
    reps.value = '7';
    reps.dispatchEvent(new Event('input'));
    root.querySelector('[data-testid="gym-log-workout"]').click();
    await flush();
    expect(saved).toHaveLength(1);
    expect(saved[0].workoutLogs[0]).toMatchObject({ day: 'Day A', mode: 'home', exercises: [{ name: 'Push-up ladder', sets: [{ weight: 0, reps: 7 }] }] });
  });
});
