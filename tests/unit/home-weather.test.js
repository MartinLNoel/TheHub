// The weather on the home screen (0.9.7, Martin 2026-11-16): the Gym's homeStatus line under the clock, drawn
// from the cached reading and refreshed in the background. The Fighter's scenes keep using the weather.
// Tests use a made-up town: Martin's own is personal data.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gym, { homeStatus } from '../../src/modules/gym/index.js';
import { defaultData } from '../../src/modules/gym/data.js';
import { CACHE_KEY, iconFor, weatherText } from '../../src/modules/gym/story/weather.js';
import { renderToday } from '../../src/core/today.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';
import demo from '../fixtures/demo-module.js';

const TOWN = { name: 'Testville', country: 'Nowhere', admin: '', lat: 10.5, lon: 20.25 };
const flush = () => new Promise((r) => setTimeout(r, 0));
const cache = (reading) => localStorage.setItem(CACHE_KEY, JSON.stringify({ lat: TOWN.lat, lon: TOWN.lon, ...reading }));

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

function home(mods, stateFor = (m) => ({ data: m.defaultData(), readOnly: false })) {
  const root = document.createElement('main');
  document.body.append(root);
  const state = Object.fromEntries(mods.map((m) => [m.id, stateFor(m)]));
  renderToday(root, { registry: createRegistry(mods), state });
  return root;
}

describe('the weather line', () => {
  it('reads as icon, words, temperature and town', () => {
    expect(weatherText(TOWN, { code: 71, isDay: 1, temp: -2.4 })).toBe('🌨️ Snow, -2°C · Testville');
    expect(weatherText(TOWN, { code: 0, isDay: 0, temp: 8 })).toBe('🌙 Clear sky, 8°C · Testville');
    expect(weatherText(TOWN, { code: 61, isDay: 1 })).toBe('🌧️ Rain · Testville');
    expect(weatherText(TOWN, null)).toBe('🌤️ Testville: weather not loaded yet');
  });

  it('has an icon for every kind of weather', () => {
    expect([0, 2, 3, 45, 53, 63, 81, 73, 95, 999].map((c) => iconFor(c, 1))).toEqual(['☀️', '⛅', '☁️', '🌫️', '🌧️', '🌧️', '🌦️', '🌨️', '⛈️', '🌤️']);
  });
});

describe('Gym → homeStatus', () => {
  it('with no town, links to Settings', () => {
    expect(homeStatus(defaultData())).toEqual({ text: '🌤️ Weather: set your town in Settings', href: '#/settings' });
  });

  it('with no data (the Gym failed to load), shows nothing', () => {
    expect(homeStatus(undefined)).toBeNull();
  });

  it('with a town, shows the cached reading and refreshes from Open-Meteo', async () => {
    cache({ code: 3, isDay: 1, temp: 5, at: Date.now() - 60 * 60 * 1000 }); // an hour old: stale
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ current: { weather_code: 71, is_day: 1, temperature_2m: -1 } }) }));
    const status = homeStatus({ ...defaultData(), weatherTown: TOWN }, { fetchFn });
    expect(status.text).toBe('☁️ Overcast, 5°C · Testville');
    expect(status.href).toBeUndefined();
    expect(await status.refresh()).toEqual({ text: '🌨️ Snow, -1°C · Testville' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('is part of the module contract, and a wrong one is refused', () => {
    expect(checkModule(gym)).toEqual([]);
    expect(checkModule({ ...demo, homeStatus: 'nope' })).toContain('homeStatus must be a function (or left out)');
  });
});

describe('the home screen shows module status lines under the clock', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('shows the Gym weather between the clock and the app icons', () => {
    cache({ code: 71, isDay: 1, temp: -2, at: Date.now() }); // fresh: no fetch
    globalThis.fetch = vi.fn(async () => {
      throw new Error('not in tests');
    });
    const root = home([gym], () => ({ data: { ...defaultData(), weatherTown: TOWN }, readOnly: false }));
    const line = root.querySelector('[data-testid="home-status-gym"]');
    expect(line.textContent).toBe('🌨️ Snow, -2°C · Testville');
    const order = [...root.querySelector('[data-testid="today"]').children].map((el) => el.className);
    expect(order.slice(0, 3)).toEqual(['home__clock', 'home__statuses', 'home__apps']);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('with no town, the line is a link to Settings', () => {
    const root = home([gym]);
    const line = root.querySelector('[data-testid="home-status-gym"]');
    expect(line.tagName).toBe('A');
    expect(line.getAttribute('href')).toBe('#/settings');
  });

  it('updates the line when the refresh brings newer weather', async () => {
    let finish;
    const mod = { ...demo, id: 'wx', homeStatus: () => ({ text: 'old', refresh: () => new Promise((r) => (finish = r)) }) };
    const root = home([mod]);
    const line = root.querySelector('[data-testid="home-status-wx"]');
    expect(line.textContent).toBe('old');
    await flush();
    finish({ text: 'new' });
    await flush();
    expect(line.textContent).toBe('new');
  });

  it('a failing status or refresh shows nothing and does not break the home', async () => {
    const broken = { ...demo, id: 'broken', homeStatus: () => { throw new Error('boom'); } };
    const failing = { ...demo, id: 'failing', homeStatus: () => ({ text: 'kept', refresh: async () => { throw new Error('offline'); } }) };
    const root = home([broken, failing]);
    expect(root.querySelector('[data-testid="home-status-broken"]')).toBeNull();
    await flush();
    expect(root.querySelector('[data-testid="home-status-failing"]').textContent).toBe('kept');
    expect(root.querySelector('[data-testid="home-apps"]')).not.toBeNull();
  });

  it('modules without a status line add nothing', () => {
    const root = home([demo]);
    expect(root.querySelector('.home__statuses')).toBeNull();
  });
});
