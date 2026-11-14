// The story Fighter (0.9.0): Season 1, the pixel scenes, real weather, schema 4,
// the "Fighter weather" Settings card. Tests use a made-up town: Martin's own is personal data.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import gym from '../../src/modules/gym/index.js';
import { SCHEMA_VERSION, defaultData, validate } from '../../src/modules/gym/data.js';
import { currentStage, nextStage } from '../../src/modules/gym/logic.js';
import { STAGES } from '../../src/modules/gym/program.js';
import { SEASON_1 } from '../../src/modules/gym/story/season1.js';
import { tadLook } from '../../src/modules/gym/story/characters.js';
import { H, W } from '../../src/modules/gym/story/pixel.js';
import { stageLayers } from '../../src/modules/gym/story/render.js';
import { CACHE_KEY, conditionsFor, currentReading, findTowns, lightAt, sceneEnv } from '../../src/modules/gym/story/weather.js';
import { resetScreenState } from '../../src/modules/gym/screens.js';
import { moduleSettingsCards } from '../../src/core/settings.js';
import { checkModule } from '../../src/core/registry.js';
import { runMigrations } from '../../src/core/db.js';

const TOWN = { name: 'Testville', country: 'Nowhere', admin: '', lat: 10.5, lon: 20.25 };
const flush = () => new Promise((r) => setTimeout(r, 0));
const logs = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, date: '2026-01-05', day: 'Day A', mode: 'home', exercises: [{ name: 'Plank', sets: [{ weight: 0, reps: 30 }] }] }));
const okJson = (body) => async () => ({ ok: true, status: 200, json: async () => body });

describe('Season 1', () => {
  it('has 20 stages from 0 to 140 sessions, each later than the one before', () => {
    expect(SEASON_1).toHaveLength(20);
    expect(SEASON_1[0].sessions).toBe(0);
    expect(SEASON_1.at(-1).sessions).toBe(140);
    SEASON_1.forEach((st, i) => {
      if (i) expect(st.sessions, st.name).toBeGreaterThan(SEASON_1[i - 1].sessions);
      expect(st.title).toMatch(new RegExp(`^Chapter ${i + 1} — `));
      expect(st.story.length, st.name).toBeGreaterThan(120);
      expect(typeof st.place).toBe('function');
      expect(typeof st.cast).toBe('function');
    });
    expect(STAGES.map((s) => s.sessions)).toEqual(SEASON_1.map((s) => s.sessions));
  });

  it('stages are earned by total sessions', () => {
    expect(currentStage(0).id).toBe(0);
    expect(currentStage(2).id).toBe(0);
    expect(currentStage(3).id).toBe(1);
    expect(currentStage(500).id).toBe(19);
    expect(nextStage(3).sessions).toBe(6);
    expect(nextStage(140)).toBeNull();
  });

  it('Tad grows: muscle never goes down, iron knuckles at stage 7, gold at 18', () => {
    for (let s = 2; s <= 20; s++) expect(tadLook(s).m).toBeGreaterThanOrEqual(tadLook(s - 1).m);
    expect(tadLook(6).fists).toBe('leather');
    expect(tadLook(7).fists).toBe('iron');
    expect(tadLook(18).fists).toEqual(['gold', 'iron']);
    expect(tadLook(12).badge).toBeTruthy();
  });

  const ENVS = [
    { light: 'night', sky: 'cloudy', precip: 'rain', fog: false, thunder: false },
    { light: 'day', sky: 'clear', precip: 'none', fog: false, thunder: false },
    { light: 'dusk', sky: 'overcast', precip: 'snow', fog: true, thunder: true },
  ];
  it.each(SEASON_1.map((st, i) => [i + 1, st.name, i]))('stage %i (%s) draws a full background and its cast, in any weather', (_, __, i) => {
    for (const env of [SEASON_1[i].env, ...ENVS]) {
      const { bg, fg, info } = stageLayers(i, env);
      expect(bg.count(), `stage ${i + 1} ${JSON.stringify(env)}`).toBe(W * H); // no gaps
      expect(fg.count()).toBeGreaterThan(400);
      expect(info.ground).toBeGreaterThan(60);
      expect(typeof info.outdoor).toBe('boolean');
      if (!info.outdoor && info.window) expect(info.window).toHaveLength(4);
    }
  });

  it('the blink only changes the eyes', () => {
    const open = stageLayers(0, SEASON_1[0].env).fg;
    const closed = stageLayers(0, SEASON_1[0].env, { blink: true }).fg;
    const changed = open.px.filter((c, i) => c !== closed.px[i]).length;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(80);
  });
});

describe('real weather', () => {
  beforeEach(() => localStorage.clear());

  it('weather codes become scene weather', () => {
    expect(conditionsFor(0)).toEqual({ sky: 'clear', precip: 'none', fog: false, thunder: false });
    expect(conditionsFor(2).sky).toBe('cloudy');
    expect(conditionsFor(45)).toMatchObject({ fog: true });
    expect(conditionsFor(53).precip).toBe('drizzle');
    expect(conditionsFor(63).precip).toBe('rain');
    expect(conditionsFor(81).precip).toBe('rain');
    expect(conditionsFor(73).precip).toBe('snow');
    expect(conditionsFor(95)).toMatchObject({ precip: 'rain', thunder: true });
  });

  it('day, dusk and night come from the local hour', () => {
    expect(lightAt(new Date(2026, 0, 5, 12))).toBe('day');
    expect(lightAt(new Date(2026, 0, 5, 18))).toBe('dusk');
    expect(lightAt(new Date(2026, 0, 5, 23))).toBe('night');
  });

  it('without a reading the scene keeps its own weather; with one, the real weather wins', () => {
    const own = SEASON_1[0].env;
    expect(sceneEnv(own, null)).toEqual(own);
    expect(sceneEnv(own, { code: 0, isDay: 1 }, new Date(2026, 0, 5, 12))).toEqual({ light: 'day', sky: 'clear', precip: 'none', fog: false, thunder: false });
    expect(sceneEnv(own, { code: 71, isDay: 0 }, new Date(2026, 0, 5, 23))).toMatchObject({ light: 'night', precip: 'snow' });
  });

  it('fetches the weather for the town, caches it, and uses the cache while it is fresh', async () => {
    const fetchFn = vi.fn(okJson({ current: { weather_code: 61, is_day: 1, temperature_2m: 7.4 } }));
    const first = await currentReading(TOWN, { fetchFn, now: 1000 });
    expect(first).toMatchObject({ code: 61, isDay: 1, temp: 7.4, lat: 10.5, lon: 20.25 });
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.open-meteo.com/v1/forecast?latitude=10.5&longitude=20.25&current=weather_code,is_day,temperature_2m&timezone=auto');
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)).code).toBe(61);
    await currentReading(TOWN, { fetchFn, now: 1000 + 60_000 });
    expect(fetchFn).toHaveBeenCalledTimes(1); // still fresh
  });

  it('offline: the last reading is used; with none, nothing (the scene keeps its own weather)', async () => {
    const down = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await currentReading(TOWN, { fetchFn: down })).toBeNull();
    await currentReading(TOWN, { fetchFn: okJson({ current: { weather_code: 3, is_day: 0 } }), now: 0 });
    expect(await currentReading(TOWN, { fetchFn: down, now: 99 * 60_000 })).toMatchObject({ code: 3 });
    expect(await currentReading(null)).toBeNull();
  });

  it('finds towns by name and keeps the position to about a kilometre', async () => {
    const fetchFn = vi.fn(okJson({ results: [{ name: 'Testville', admin1: 'North', country: 'Nowhere', latitude: 10.51234, longitude: 20.24987 }] }));
    expect(await findTowns('Testville', { fetchFn })).toEqual([{ name: 'Testville', country: 'Nowhere', admin: 'North', lat: 10.51, lon: 20.25 }]);
    expect(fetchFn.mock.calls[0][0]).toContain('geocoding-api.open-meteo.com/v1/search?name=Testville');
    expect(await findTowns('T', { fetchFn })).toEqual([]);
  });
});

describe('schema 4: the weather town', () => {
  it('a fresh store has no town; version 3 data migrates to none', () => {
    expect(SCHEMA_VERSION).toBe(4);
    expect(defaultData().weatherTown).toBeNull();
    const v3 = { ...defaultData() };
    delete v3.weatherTown;
    expect(runMigrations(v3, 3, 4, gym.migrations)).toEqual({ ...v3, weatherTown: null });
  });

  it('accepts a town with a position, and refuses a broken one', () => {
    expect(validate({ ...defaultData(), weatherTown: TOWN })).toEqual([]);
    for (const bad of [{ name: '', lat: 1, lon: 1 }, { name: 'X', lat: 91, lon: 1 }, { name: 'X', lat: 1 }, 'Testville']) {
      expect(validate({ ...defaultData(), weatherTown: bad })).toContain('weatherTown must be null or a town with a name, lat and lon');
    }
  });
});

describe('Settings → Fighter weather', () => {
  beforeEach(() => document.body.replaceChildren());

  function settingsWith(data, { readOnly = false } = {}) {
    const saved = [];
    const entry = { data, readOnly };
    const ctx = {
      registry: { list: () => [gym] },
      state: { gym: entry },
      storage: { save: vi.fn(async (mod, d) => saved.push(d)) },
    };
    const root = document.createElement('main');
    document.body.append(root);
    root.append(...moduleSettingsCards(ctx));
    return { root, saved, entry };
  }

  it('the module contract allows a settings card, and a wrong one is refused', () => {
    expect(checkModule(gym)).toEqual([]);
    expect(checkModule({ ...gym, settingsCard: 'nope' })).toContain('settingsCard must be a function (or left out)');
  });

  it('shows no town at first; search, pick and it is saved', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(okJson({ results: [{ name: 'Testville', admin1: 'North', country: 'Nowhere', latitude: 10.5, longitude: 20.25 }] }));
    try {
      const { root, saved, entry } = settingsWith(defaultData());
      expect(root.querySelector('[data-testid="weather-town"]').textContent).toBe('No town set: the story uses its own weather.');
      root.querySelector('[data-testid="weather-town-input"]').value = 'Testville';
      root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
      await flush();
      await flush();
      const pick = [...root.querySelectorAll('[data-testid="weather-results"] button')];
      expect(pick.map((b) => b.textContent)).toEqual(['Testville, North, Nowhere']);
      pick[0].click();
      await flush();
      expect(saved).toHaveLength(1);
      expect(saved[0].weatherTown).toEqual({ name: 'Testville', country: 'Nowhere', admin: 'North', lat: 10.5, lon: 20.25 });
      expect(entry.data.weatherTown.name).toBe('Testville');
      expect(root.querySelector('[data-testid="weather-town"]').textContent).toBe('Town: Testville, North, Nowhere');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('removes the town', async () => {
    const { root, saved } = settingsWith({ ...defaultData(), weatherTown: TOWN });
    root.querySelector('[data-testid="weather-remove"]').click();
    await flush();
    expect(saved[0].weatherTown).toBeNull();
  });
});

describe('the Fighter screen', () => {
  beforeEach(() => {
    resetScreenState();
    document.body.replaceChildren();
    localStorage.clear();
  });

  function mountFighter(data) {
    const root = document.createElement('main');
    document.body.append(root);
    gym.routes.fighter({ root, data, readOnly: false, save: vi.fn(async () => {}), navigate: vi.fn() });
    return root;
  }

  it('shows the current stage as a scene with its chapter, and asks for a town', () => {
    const root = mountFighter({ ...defaultData(), workoutLogs: logs(4) });
    expect(root.querySelector('canvas.gym-story').dataset.stage).toBe('2');
    expect(root.querySelector('[data-testid="gym-chapter"] h2').textContent).toBe(SEASON_1[1].title);
    expect(root.querySelector('[data-testid="gym-chapter"] p').textContent).toBe(SEASON_1[1].story);
    expect(root.querySelector('[data-testid="gym-weather"] a').getAttribute('href')).toBe('#/settings');
  });

  it('a locked stage shows no scene and no story', () => {
    const root = mountFighter(defaultData());
    root.querySelector('[aria-label="Next stage"]').click();
    expect(root.querySelector('[data-testid="gym-story-locked"]').textContent).toContain('Unlocks at 3 sessions');
    expect(root.querySelector('canvas.gym-story')).toBeNull();
    expect(root.querySelector('[data-testid="gym-chapter"]').textContent).not.toContain(SEASON_1[1].story.slice(0, 30));
    expect(root.querySelector('[data-testid="gym-stage-name"]').textContent).toBe('???');
    expect([...root.querySelectorAll('.gym-stage__name')].filter((n) => n.textContent !== '???')).toHaveLength(1);
  });

  it('with a town and a cached reading, the scene uses the real weather', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ code: 71, isDay: 1, temp: -2, at: Date.now(), lat: TOWN.lat, lon: TOWN.lon }));
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error('not in tests');
    });
    try {
      const root = mountFighter({ ...defaultData(), weatherTown: TOWN });
      expect(root.querySelector('canvas.gym-story').dataset.weather).toMatch(/overcast snow/);
      expect(root.querySelector('[data-testid="gym-weather"]').textContent).toBe('🌦 Weather from Testville: snow, -2°C');
      expect(globalThis.fetch).not.toHaveBeenCalled(); // the cache is fresh
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
