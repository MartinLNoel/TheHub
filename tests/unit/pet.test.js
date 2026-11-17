// The companion pet (0.9.12): its meals from the other apps' activities, growth and mood, the home widget and
// its page, and that it stays off the app icons and the nav. jsdom has no canvas: drawing is skipped there.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import pet from '../../src/modules/pet/index.js';
import { KEEP_DAYS, STAGES, defaultData, eat, moodFor, newMeals, nextStage, rename, stageFor, tapped, validate } from '../../src/modules/pet/data.js';
import { collectActivities, homeWidget } from '../../src/modules/pet/screens.js';
import { draw, GW, GH } from '../../src/modules/pet/art.js';
import { renderToday } from '../../src/core/today.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';
import { createHub } from '../../src/core/hub.js';
import gym from '../../src/modules/gym/index.js';
import fridge from '../../src/modules/fridge/index.js';
import istqb from '../../src/modules/istqb/index.js';
import bulgarian from '../../src/modules/bulgarian/index.js';
import { defaultData as gymDefault } from '../../src/modules/gym/data.js';
import { defaultData as fridgeDefault } from '../../src/modules/fridge/data.js';
import { logFood } from '../../src/modules/fridge/food.js';

const NOON = new Date(2026, 10, 18, 12, 0); // Wednesday 18 November 2026, local noon
const born = (date = '2026-11-17') => ({ ...defaultData(NOON), born: date });
const meal = (id, kind, date) => ({ id, kind, date });
const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('meals', () => {
  it('only activities from its birth on, at most 30 days back, not eaten before, oldest first', () => {
    const acts = [meal('a', 'workout', '2026-11-18'), meal('b', 'study', '2026-11-16'), meal('c', 'food', '2026-11-17'), meal('a', 'workout', '2026-11-18'), meal('x', 'nope', '2026-11-18'), meal('f', 'food', '2026-11-19')];
    expect(newMeals(born(), acts, NOON).map((m) => m.id)).toEqual(['c', 'a']); // b before birth, f in the future
    const fed = eat(born(), newMeals(born(), acts, NOON), NOON);
    expect(fed).toMatchObject({ meals: 2, lastMeal: '2026-11-18', byKind: { workout: 1, study: 0, bulgarian: 0, food: 1 } });
    expect(newMeals(fed, acts, NOON)).toEqual([]);
    expect(validate(fed)).toEqual([]);
  });

  it('forgets eaten ids after a while, but never eats them again (they are too old by then)', () => {
    const old = eat(born('2026-09-01'), [meal('old', 'workout', '2026-09-02')], new Date(2026, 8, 2, 12));
    const later = eat(old, [meal('new', 'food', '2026-11-18')], NOON);
    expect(later.eaten.map((e) => e.id)).toEqual(['new']); // older than KEEP_DAYS: dropped
    expect(KEEP_DAYS).toBeGreaterThan(30);
    expect(newMeals(later, [meal('old', 'workout', '2026-09-02')], NOON)).toEqual([]); // beyond the 30-day look-back
  });

  it('grows with its meals', () => {
    expect([0, 1, 4, 5, 19, 20, 49, 50, 300].map((n) => stageFor(n).id)).toEqual(['egg', 'baby', 'baby', 'young', 'young', 'grown', 'grown', 'elder', 'elder']);
    expect(nextStage(3)).toEqual(STAGES[2]);
    expect(nextStage(50)).toBeNull();
  });

  it('is never sad: happy, content, a bit bored, asleep at night, or waiting as an egg', () => {
    const fed = { ...born(), meals: 3, lastMeal: '2026-11-18' };
    expect(moodFor(fed, NOON)).toBe('happy');
    expect(moodFor({ ...fed, lastMeal: '2026-11-16' }, NOON)).toBe('content');
    expect(moodFor({ ...fed, lastMeal: '2026-10-01' }, NOON)).toBe('bored');
    expect(moodFor(fed, new Date(2026, 10, 18, 23, 30))).toBe('sleeping');
    expect(moodFor(fed, new Date(2026, 10, 18, 6, 59))).toBe('sleeping');
    expect(moodFor(born(), NOON)).toBe('waiting');
  });

  it('rename and taps', () => {
    expect(rename(born(), '  Mos  ').name).toBe('Mos');
    expect(rename(born(), '   ').name).toBe('Pip');
    expect(rename(born(), 'x'.repeat(40)).name).toHaveLength(24);
    expect(tapped(tapped(born())).taps).toBe(2);
    expect(validate({ ...born(), name: '' })).toContain('the pet needs a name of at most 24 characters');
  });
});

describe('the apps feed it through the hub', () => {
  it('a workout, a study session, a day of Bulgarian and a day of food each answer as one meal', () => {
    const gymData = { ...gymDefault(), workoutLogs: [{ id: 7, date: '2026-11-18', day: 'Day A', mode: 'home', exercises: [] }] };
    const fridgeData = logFood(logFood(fridgeDefault(), { name: 'A', kcal: 1, from: 'manual' }, NOON), { name: 'B', kcal: 1, from: 'manual' }, NOON);
    const istqbData = { ...istqb.defaultData(), sessions: [{ no: 10, date: '2026-11-18', section: '3.1', score: 80, correct: 4, total: 5, kind: 'lesson' }] };
    const bgData = { ...bulgarian.defaultData(), activity: ['2026-11-17', '2026-11-18'] };
    const registry = createRegistry([gym, istqb, bulgarian, fridge, pet]);
    const state = { gym: { data: gymData }, istqb: { data: istqbData }, bulgarian: { data: bgData }, fridge: { data: fridgeData }, pet: { data: born() } };
    const hub = createHub({ registry, state, save: vi.fn() });
    const acts = collectActivities(hub);
    expect(acts.map((a) => a.id).sort()).toEqual(['bg-2026-11-17', 'bg-2026-11-18', 'food-2026-11-18', 'gym-7', 'istqb-10-lesson-2026-11-18']);
    expect(newMeals(born(), acts, NOON)).toHaveLength(5);
  });
});

describe('the home widget', () => {
  beforeEach(() => document.body.replaceChildren());

  const hubWith = (acts) => ({ accepts: () => false, offer: async () => ({}), ask: (id, q) => (q === 'activities' && id === 'gym' ? acts : null) });

  it('an egg first; the first meal hatches it, saved before it is shown', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] });
    try {
      const saved = [];
      const node = homeWidget({ data: born(), readOnly: false, hub: hubWith([meal('gym-1', 'workout', '2026-11-18')]), save: async (d) => saved.push(d) }, { now: () => NOON });
      document.body.append(node);
      expect(node.querySelector('[data-testid="pet-canvas"]').dataset.stage).toBe('egg');
      await node.ready;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ meals: 1, lastMeal: '2026-11-18' });
      expect(node.querySelector('[data-testid="pet-canvas"]').dataset.stage).toBe('baby');
      vi.advanceTimersByTime(10);
      expect(node.querySelector('[data-testid="pet-say"]').textContent).toBe('It hatched! Yum: a workout.');
      expect(node.querySelector('[data-testid="pet-status"]').textContent).toBe('Hatchling · happy · 1 meal');
    } finally {
      vi.useRealTimers();
    }
  });

  it('nothing new: no save; a tap makes it react and counts', async () => {
    const saved = [];
    const data = { ...born(), meals: 6, lastMeal: '2026-11-18', eaten: [{ id: 'gym-1', date: '2026-11-18' }], byKind: { workout: 6, study: 0, bulgarian: 0, food: 0 } };
    const node = homeWidget({ data, readOnly: false, hub: hubWith([meal('gym-1', 'workout', '2026-11-18')]), save: async (d) => saved.push(d) }, { now: () => NOON, random: () => 0.5 });
    document.body.append(node);
    await node.ready;
    expect(saved).toEqual([]);
    expect(node.querySelector('[data-testid="pet-canvas"]').dataset.stage).toBe('young');
    node.querySelector('[data-testid="pet-canvas"]').click();
    await flush();
    expect(saved).toHaveLength(1);
    expect(saved[0].taps).toBe(1);
    expect(node.querySelector('[data-testid="pet-name"]').getAttribute('href')).toBe('#/pet');
  });

  it('read-only (newer data on the phone): it shows, but eats and saves nothing', async () => {
    const save = vi.fn();
    const node = homeWidget({ data: born(), readOnly: true, hub: hubWith([meal('gym-1', 'workout', '2026-11-18')]), save }, { now: () => NOON });
    await node.ready;
    node.querySelector('[data-testid="pet-canvas"]').click();
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('on the home screen: after the app icons, with no icon or nav tab of its own', () => {
    const root = document.createElement('main');
    document.body.append(root);
    const mods = [gym, pet];
    renderToday(root, { registry: createRegistry(mods), state: { gym: { data: gymDefault() }, pet: { data: born() } }, saveFor: () => async () => {} });
    expect([...root.querySelectorAll('.app-icon')].map((a) => a.dataset.app)).toEqual(['gym', 'settings']);
    const order = [...root.querySelector('[data-testid="today"]').children].map((el) => el.dataset.testid || el.className);
    expect(order.indexOf('pet-widget')).toBe(order.indexOf('home-apps') + 1);
  });

  it('the contract: hidden and homeWidget are checked', () => {
    expect(checkModule(pet)).toEqual([]);
    expect(checkModule({ ...pet, hidden: 'yes' })).toContain('hidden must be true or false (or left out)');
    expect(checkModule({ ...pet, homeWidget: 1 })).toContain('homeWidget must be a function (or left out)');
  });
});

describe('the drawing', () => {
  it('draws every stage and mood without going off the grid', () => {
    const calls = [];
    const g = { fillStyle: '', clearRect: () => {}, fillRect: (x, y) => calls.push([x, y]) };
    for (const stage of ['egg', 'baby', 'young', 'grown', 'elder']) {
      for (const mood of ['waiting', 'happy', 'content', 'bored', 'sleeping']) {
        for (const action of [null, { kind: 'hop', t0: 0 }, { kind: 'eat', t0: 0 }, { kind: 'spin', t0: 0 }]) {
          for (let t = 0; t < 50; t += 7) draw(g, { stage, mood, t, action });
        }
      }
    }
    expect(calls.length).toBeGreaterThan(1000);
    expect(calls.every(([x, y]) => x >= 0 && y >= 0 && x < GW && y < GH)).toBe(true);
  });
});
