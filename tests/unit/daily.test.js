// Daily checks (0.9.13): ticking once a day, the reset at midnight, the streak and history, editing checks, and the
// home screen's tick buttons under "Today".
import { afterEach, describe, expect, it, vi } from 'vitest';
import daily from '../../src/modules/daily/index.js';
import { HISTORY_DAYS, MAX_CHECKS, addCheck, defaultData, doneToday, editCheck, lastDays, removeCheck, streak, toggle, validate } from '../../src/modules/daily/data.js';
import { renderDaily, todayWidget } from '../../src/modules/daily/screens.js';
import { renderToday } from '../../src/core/today.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';

const at = (y, m, d, hh = 9, mm = 0, ss = 0) => new Date(y, m - 1, d, hh, mm, ss);
const MORNING = at(2026, 11, 21, 8);
const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('the data', () => {
  it('starts with one check, valid, not done', () => {
    const d = defaultData();
    expect(validate(d)).toEqual([]);
    expect(d.checks).toHaveLength(1);
    expect(doneToday(d, 'c1', MORNING)).toBe(false);
    expect(checkModule(daily)).toEqual([]);
  });

  it('a tick counts for today only: the next day it is unticked again', () => {
    const d = toggle(defaultData(), 'c1', MORNING);
    expect(doneToday(d, 'c1', MORNING)).toBe(true);
    expect(doneToday(d, 'c1', at(2026, 11, 21, 23, 59))).toBe(true);
    expect(doneToday(d, 'c1', at(2026, 11, 22, 0, 0))).toBe(false);
    expect(validate(d)).toEqual([]);
  });

  it('a second tap the same day unticks (a mis-tap can be undone) and keeps earlier days', () => {
    let d = toggle(defaultData(), 'c1', at(2026, 11, 20));
    d = toggle(d, 'c1', MORNING);
    d = toggle(d, 'c1', MORNING);
    expect(d.done.c1).toEqual(['2026-11-20']);
  });

  it('ignores an unknown check and forgets days older than the history window', () => {
    const d0 = defaultData();
    expect(toggle(d0, 'c9', MORNING)).toBe(d0);
    const old = { ...d0, done: { c1: ['2026-01-01', '2026-11-20'] } };
    expect(toggle(old, 'c1', MORNING).done.c1).toEqual(['2026-11-20', '2026-11-21']);
    expect(HISTORY_DAYS).toBeGreaterThanOrEqual(14);
  });

  it('the streak: days in a row; today not ticked yet does not break it', () => {
    const d = { ...defaultData(), done: { c1: ['2026-11-17', '2026-11-19', '2026-11-20'] } };
    expect(streak(d, 'c1', MORNING)).toBe(2);
    expect(streak(toggle(d, 'c1', MORNING), 'c1', MORNING)).toBe(3);
    expect(streak(d, 'c1', at(2026, 11, 22))).toBe(0);
  });

  it('the last 14 days, oldest first', () => {
    const d = { ...defaultData(), done: { c1: ['2026-11-08', '2026-11-21'] } };
    const days = lastDays(d, 'c1', 14, MORNING);
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ day: '2026-11-08', done: true });
    expect(days.at(-1)).toEqual({ day: '2026-11-21', done: true });
    expect(days.filter((x) => x.done)).toHaveLength(2);
  });

  it('add, rename and remove; ids are never reused; at most six', () => {
    let d = addCheck(defaultData(), '  Stretch  ', '🧘');
    expect(d.checks[1]).toEqual({ id: 'c2', name: 'Stretch', icon: '🧘' });
    d = editCheck(d, 'c1', 'Read', '');
    expect(d.checks[0]).toEqual({ id: 'c1', name: 'Read', icon: '✅' });
    expect(editCheck(d, 'c1', '   ', 'x')).toBe(d);
    d = removeCheck(d, 'c2');
    expect(d.done.c2).toBeUndefined();
    d = addCheck(d, 'Water', '');
    expect(d.checks.map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(addCheck(d, '', 'x')).toBe(d);
    for (let i = 0; i < 10; i++) d = addCheck(d, `n${i}`);
    expect(d.checks).toHaveLength(MAX_CHECKS);
    expect(validate(d)).toEqual([]);
  });

  it('validate catches broken data', () => {
    expect(validate(null)).not.toEqual([]);
    expect(validate({ ...defaultData(), checks: [{ id: 'c1', name: '', icon: '💊' }] })).not.toEqual([]);
    expect(validate({ ...defaultData(), checks: [{ id: 'c1', name: 'a', icon: 'x' }, { id: 'c1', name: 'b', icon: 'y' }] })).not.toEqual([]);
    expect(validate({ ...defaultData(), done: { c1: ['21-11-2026'] } })).not.toEqual([]);
  });
});

describe('the home screen', () => {
  afterEach(() => vi.useRealTimers());

  it('a tick button under "Today": a tap saves and shows it done; a second tap undoes it', async () => {
    const saved = [];
    const node = todayWidget({ data: defaultData(), readOnly: false, save: async (d) => saved.push(d) }, { now: () => MORNING });
    document.body.replaceChildren(node);
    const btn = () => node.querySelector('[data-testid="daily-c1"]');
    expect(btn().getAttribute('aria-pressed')).toBe('false');
    expect(btn().textContent).toContain('Not yet today');
    btn().click();
    await flush();
    expect(saved.at(-1).done.c1).toEqual(['2026-11-21']);
    expect(btn().getAttribute('aria-pressed')).toBe('true');
    expect(btn().textContent).toContain('Done today');
    btn().click();
    await flush();
    expect(saved.at(-1).done.c1).toEqual([]);
    expect(btn().getAttribute('aria-pressed')).toBe('false');
  });

  it('a failed save shows why and leaves it unticked', async () => {
    const save = async () => {
      throw new Error('disk full');
    };
    const node = todayWidget({ data: defaultData(), readOnly: false, save }, { now: () => MORNING });
    document.body.replaceChildren(node);
    node.querySelector('[data-testid="daily-c1"]').click();
    await flush();
    expect(node.querySelector('[data-testid="daily-msg"]').textContent).toContain('disk full');
    expect(node.querySelector('[data-testid="daily-c1"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('left open past midnight, it resets by itself', () => {
    vi.useFakeTimers();
    let now = at(2026, 11, 21, 23, 59, 30);
    const data = toggle(defaultData(), 'c1', now);
    const node = todayWidget({ data, readOnly: false, save: async () => {} }, { now: () => now });
    document.body.replaceChildren(node);
    expect(node.querySelector('[data-testid="daily-c1"]').getAttribute('aria-pressed')).toBe('true');
    now = at(2026, 11, 22, 0, 1);
    vi.advanceTimersByTime(60_000);
    expect(node.querySelector('[data-testid="daily-c1"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('read-only (newer data) cannot tick; no checks shows nothing', () => {
    const node = todayWidget({ data: defaultData(), readOnly: true, save: async () => {} });
    expect(node.querySelector('[data-testid="daily-c1"]').disabled).toBe(true);
    expect(todayWidget({ data: { ...defaultData(), checks: [] }, readOnly: false, save: async () => {} })).toBeNull();
  });

  it('renderToday puts it right under the "Today" heading, with a save for its data, and no app icon', async () => {
    const registry = createRegistry([daily]);
    const saves = [];
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    renderToday(root, { registry, state: { daily: { data: defaultData(), readOnly: false } }, saveFor: (mod) => async (d) => saves.push([mod.id, d]) });
    const heading = [...root.querySelectorAll('.home__heading')].find((x) => x.textContent === 'Today');
    expect(heading.nextElementSibling.dataset.testid).toBe('daily-widget');
    root.querySelector('[data-testid="daily-c1"]').click();
    await flush();
    expect(saves[0][0]).toBe('daily');
    expect(root.querySelector('.app-icon[data-app="daily"]')).toBeNull();
  });

  it('the registry rejects a todayWidget that is not a function', () => {
    expect(checkModule({ ...daily, todayWidget: 'x' })).toContain('todayWidget must be a function (or left out)');
  });
});

describe('the page', () => {
  it('shows the last 14 days and the streak, and adds, renames and removes checks', async () => {
    let data = toggle(toggle(defaultData(), 'c1', at(2026, 11, 20)), 'c1', MORNING);
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    renderDaily({ root, data, readOnly: false, save: async (d) => (data = d) }, { now: () => MORNING });
    expect(root.querySelectorAll('[data-testid="daily-history-c1"] .daily-day--done')).toHaveLength(2);
    expect(root.textContent).toContain('2 days in a row.');

    root.querySelector('[data-testid="daily-new-name"]').value = 'Stretch';
    root.querySelector('[data-testid="daily-add"]').click();
    await flush();
    expect(data.checks.map((c) => c.name)).toEqual(['Daily check', 'Stretch']);

    root.querySelector('[data-testid="daily-name-c1"]').value = 'Morning walk';
    root.querySelector('[data-testid="daily-save-c1"]').click();
    await flush();
    expect(data.checks[0].name).toBe('Morning walk');

    globalThis.confirm = () => true;
    root.querySelector('[data-testid="daily-remove-c2"]').click();
    await flush();
    delete globalThis.confirm;
    expect(data.checks.map((c) => c.id)).toEqual(['c1']);
  });
});
