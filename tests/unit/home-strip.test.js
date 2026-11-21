// The home screen's "today" strip and market session clock (0.9.11, decided with Martin 2026-11-16): each module's
// homeTile, the forex session hours (src/core/markets.js), and how the home screen draws them.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSIONS, isOpen, marketStatus, nextChange, untilText, zoned } from '../../src/core/markets.js';
import { marketCard, renderToday } from '../../src/core/today.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';
import gym, { homeTile as gymTile } from '../../src/modules/gym/index.js';
import fridge, { homeTile as fridgeTile } from '../../src/modules/fridge/index.js';
import istqb, { homeTile as istqbTile } from '../../src/modules/istqb/index.js';
import bulgarian, { wordOfTheDay } from '../../src/modules/bulgarian/index.js';
import { defaultData as gymDefault } from '../../src/modules/gym/data.js';
import { addItem, defaultData as fridgeDefault } from '../../src/modules/fridge/data.js';
import { logFood } from '../../src/modules/fridge/food.js';
import demo from '../fixtures/demo-module.js';

const at = (iso) => new Date(iso);
const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
const byId = (m) => Object.fromEntries(m.sessions.map((s) => [s.id, s]));

describe('market sessions (usual forex hours, in each city\'s own time)', () => {
  it('a weekday afternoon in Europe: London and New York open and overlapping, Tokyo closed', () => {
    const m = marketStatus(at('2026-11-17T14:00:00Z')); // Tuesday: 14:00 London, 09:00 New York, 23:00 Tokyo
    const s = byId(m);
    expect([s.tokyo.text, s.london.text, s.newyork.text]).toEqual(['Closed · opens in 10h 00m', 'Open · closes in 3h 00m', 'Open · closes in 8h 00m']);
    expect(m.overlap).toBe(true);
  });

  it('the weekend: everything closed until Monday, Tokyo first', () => {
    const s = byId(marketStatus(at('2026-11-21T12:00:00Z'))); // Saturday noon UTC
    expect([s.tokyo.text, s.london.text, s.newyork.text]).toEqual(['Closed · opens in 1d 12h', 'Closed · opens in 1d 20h', 'Closed · opens in 2d 1h']);
  });

  it('summer time per city: the US week between the two changes (New York on summer time, London not yet)', () => {
    const date = at('2026-03-10T12:30:00Z');
    expect(zoned(date, 'America/New_York')).toEqual({ weekday: 2, hour: 8, minute: 30 });
    expect(zoned(date, 'Europe/London')).toEqual({ weekday: 2, hour: 12, minute: 30 });
    const s = byId(marketStatus(date));
    expect(s.newyork.text).toBe('Open · closes in 8h 30m');
    expect(s.london.text).toBe('Open · closes in 4h 30m');
  });

  it('opens and closes on the hour: one minute before, at, and one minute after', () => {
    const tokyo = SESSIONS.find((x) => x.id === 'tokyo');
    expect(isOpen(tokyo, at('2026-11-17T23:59:00Z'))).toBe(false); // 08:59 Wednesday in Tokyo
    expect(isOpen(tokyo, at('2026-11-18T00:00:00Z'))).toBe(true);
    expect(nextChange(tokyo, at('2026-11-17T23:59:00Z')).toISOString()).toBe('2026-11-18T00:00:00.000Z');
    expect(isOpen(tokyo, at('2026-11-18T08:59:00Z'))).toBe(true); // 17:59
    expect(isOpen(tokyo, at('2026-11-18T09:00:00Z'))).toBe(false); // 18:00
  });

  it('writes durations shortly', () => {
    expect([untilText(60_000), untilText(45 * 60_000), untilText(125 * 60_000), untilText(37 * 3_600_000)]).toEqual(['1m', '45m', '2h 05m', '1d 13h']);
  });

  it('the card draws a row per city and the overlap line', () => {
    const card = marketCard(() => at('2026-11-17T14:00:00Z'));
    expect([...card.querySelectorAll('.markets__row')].map((r) => r.dataset.testid)).toEqual(['market-tokyo', 'market-london', 'market-newyork']);
    expect(card.querySelector('[data-testid="market-london"]').classList.contains('markets__row--open')).toBe(true);
    expect(card.querySelector('[data-testid="markets-overlap"]').hidden).toBe(false);
    const quiet = marketCard(() => at('2026-11-21T12:00:00Z'));
    expect(quiet.querySelector('[data-testid="markets-overlap"]').hidden).toBe(true);
  });
});

describe('the modules\' "today" tiles', () => {
  const WED = new Date(2026, 10, 18, 10, 0);

  it('Gym: today\'s day and the week; rest once the week is done', () => {
    expect(gymTile(gymDefault(), WED)).toMatchObject({ title: 'Gym', sub: '0/3 this week', href: '#/gym/log' });
    expect(gymTile(gymDefault(), WED).text).toBeTruthy();
    expect(gymTile(undefined)).toBeNull();
  });

  it('Fridge: what expires soon, and today\'s calories', () => {
    let d = logFood(fridgeDefault(), { name: 'Shake', protein: 25, kcal: 120, from: 'quick' }, WED);
    expect(fridgeTile(d, WED)).toEqual({ title: 'Fridge', text: 'Nothing expiring', sub: '120 kcal today', href: '#/fridge/food' });
    d = addItem(d, { name: 'Milk', location: 'fridge', expiry: '2026-11-18' }, WED).data;
    expect(fridgeTile(d, WED)).toMatchObject({ text: '1 expiring soon', href: '#/fridge' });
  });

  it('ISTQB: the next session and the reviews due', () => {
    expect(istqbTile(istqb.defaultData())).toEqual({ title: 'ISTQB', text: 'Session 1 next', sub: '0 to review', href: '#/istqb' });
  });

  it('Bulgarian: the same word all day, the next one tomorrow (shown under "Today" since 0.9.14, not as a tile)', () => {
    const words = [{ id: 'a', bg: 'здравей', en: 'hello' }, { id: 'b', bg: 'благодаря', en: 'thank you' }];
    expect(wordOfTheDay(words, new Date(2026, 10, 18, 7))).toBe(wordOfTheDay(words, new Date(2026, 10, 18, 23)));
    expect(wordOfTheDay(words, new Date(2026, 10, 18))).not.toBe(wordOfTheDay(words, new Date(2026, 10, 19)));
    expect(wordOfTheDay([], WED)).toBeNull();
    expect(bulgarian.homeTile).toBeUndefined();
  });

  it('the contract checks homeTile', () => {
    for (const mod of [gym, fridge, istqb, bulgarian]) expect(checkModule(mod)).toEqual([]);
    expect(checkModule({ ...demo, homeTile: 'nope' })).toContain('homeTile must be a function (or left out)');
  });
});

describe('the home screen', () => {
  beforeEach(() => document.body.replaceChildren());

  function home(mods, stateFor = (m) => ({ data: m.defaultData(), readOnly: false })) {
    const root = document.createElement('main');
    document.body.append(root);
    renderToday(root, { registry: createRegistry(mods), state: Object.fromEntries(mods.map((m) => [m.id, stateFor(m)])) });
    return root;
  }

  it('draws a tile per module in its colour, then the market clock, under "Today"', () => {
    const root = home([gym, fridge, istqb]);
    const tiles = [...root.querySelectorAll('[data-testid="home-strip"] .home-tile')];
    expect(tiles.map((t) => t.dataset.testid)).toEqual(['home-tile-gym', 'home-tile-fridge', 'home-tile-istqb']);
    expect(tiles[0].getAttribute('style')).toBe('--app:#f06a3a');
    const order = [...root.querySelector('[data-testid="today"]').children].map((el) => el.dataset.testid || el.className);
    expect(order.indexOf('home-strip')).toBeGreaterThan(order.indexOf('home__heading'));
    expect(order.indexOf('markets')).toBe(order.indexOf('home-strip') + 1);
  });

  it('a refresh fills a tile in later; a failing tile is left out', async () => {
    let finish;
    const slow = { ...demo, id: 'slow', homeTile: () => ({ title: 'Slow', text: 'Word of the day', sub: 'loading…', refresh: () => new Promise((r) => (finish = r)) }) };
    const broken = { ...demo, id: 'broken', homeTile: () => { throw new Error('boom'); } };
    const root = home([slow, broken]);
    expect(root.querySelector('[data-testid="home-tile-broken"]')).toBeNull();
    await flush();
    finish({ text: 'здравей', sub: 'hello' });
    await flush();
    const t = root.querySelector('[data-testid="home-tile-slow"]');
    expect([t.querySelector('.home-tile__text').textContent, t.querySelector('.home-tile__sub').textContent]).toEqual(['здравей', 'hello']);
  });

  it('modules without tiles: no strip, the market clock still shows', () => {
    const root = home([demo]);
    expect(root.querySelector('[data-testid="home-strip"]')).toBeNull();
    expect(root.querySelector('[data-testid="markets"]')).not.toBeNull();
  });

  it('stored text in a tile is text, never markup', () => {
    const evil = { ...demo, id: 'evil', homeTile: () => ({ title: 'X', text: '<img src=x onerror=alert(1)>', sub: '' }) };
    const root = home([evil]);
    expect(root.querySelector('img')).toBeNull();
  });
});

vi.restoreAllMocks();
