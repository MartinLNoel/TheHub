// Gym screens in jsdom, and the core's module-import flow (Settings → Import from gainz-tracker).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import gym from '../../src/modules/gym/index.js';
import { defaultData } from '../../src/modules/gym/data.js';
import { resetScreenState } from '../../src/modules/gym/screens.js';
import { applyModuleImport, importerCards, runPrepare } from '../../src/core/module-import.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';
import { openStorage } from '../../src/core/db.js';
import { GAINZ_STATE_KEY } from '../../src/modules/gym/import.js';

const FIXTURE = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'gainz-export.synthetic.json'), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));

function mountRoute(route, data, { readOnly = false } = {}) {
  const root = document.createElement('main');
  document.body.append(root);
  const saved = [];
  const ctx = {
    root,
    data,
    readOnly,
    save: vi.fn(async (d) => saved.push(d)),
    navigate: vi.fn(),
  };
  gym.routes[route](ctx);
  return { root, ctx, saved };
}

beforeEach(() => {
  resetScreenState();
  document.body.replaceChildren();
});
afterEach(() => vi.useRealTimers());

describe('screens render', () => {
  it.each(['', 'log', 'history', 'fighter', 'protein', 'checkin'])('route "%s" renders with fresh and imported data', (route) => {
    const imported = gym.importers[0].prepare(FIXTURE, defaultData()).data;
    for (const data of [defaultData(), imported]) {
      const { root } = mountRoute(route, data);
      expect(root.querySelector('.gym')).not.toBeNull();
      expect(root.querySelectorAll('.gym-tab')).toHaveLength(5);
    }
  });

  it('stored text is shown as text, never as markup', () => {
    const data = { ...defaultData(), myFoods: [{ name: '<img src=x onerror=alert(1)>', protein: 5 }] };
    const { root } = mountRoute('protein', data);
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('the Fighter shows the 20 stages of Season 1 and the current one, as a story scene', () => {
    const imported = gym.importers[0].prepare(FIXTURE, defaultData()).data; // 5 workouts: stage 2
    const { root } = mountRoute('fighter', imported);
    expect(root.querySelectorAll('.gym-stage')).toHaveLength(20);
    expect(root.querySelector('[data-testid="gym-stage-label"]').textContent).toBe('SEASON 1 · STAGE 2 OF 20');
    expect(root.querySelector('[data-testid="gym-fighter-char"] canvas.gym-story').dataset.stage).toBe('2');
  });
});

describe('logging on the Workout screen', () => {
  it('saves the entered sets and shows the next day', async () => {
    const { root, saved } = mountRoute('log', defaultData());
    expect(root.querySelector('[data-testid="gym-day"]').textContent).toBe('Upper A');
    const w = root.querySelector('[data-testid="set-0-0-weight"]');
    const r = root.querySelector('[data-testid="set-0-0-reps"]');
    w.value = '40';
    w.dispatchEvent(new Event('input'));
    r.value = '10';
    r.dispatchEvent(new Event('input'));
    root.querySelector('[data-testid="gym-log-workout"]').click();
    await flush();
    expect(saved).toHaveLength(1);
    expect(saved[0].workoutLogs[0].exercises).toEqual([{ name: 'Incline Chest Press', sets: [{ weight: 40, reps: 10 }] }]);
    expect(root.querySelector('[data-testid="gym-day"]').textContent).toBe('Lower A');
  });

  it('read-only: nothing can be logged', () => {
    const { root } = mountRoute('', defaultData(), { readOnly: true });
    expect(root.querySelector('[data-testid="gym-log-workout"]').disabled).toBe(true);
    expect(root.textContent).toMatch(/Read-only/);
  });
});

describe('module importers (core)', () => {
  it('the registry checks importers', () => {
    expect(checkModule({ ...gym, importers: 'x' })).toContain('importers must be a list (or left out)');
    expect(checkModule({ ...gym, importers: [{ id: 'a', title: 'A' }] })).toContain('importers[0].prepare must be a function');
  });

  it('runPrepare turns a crash into a refusal', () => {
    const r = runPrepare({ prepare: () => { throw new Error('boom'); } }, '', {});
    expect(r).toEqual({ ok: false, problems: ['The file could not be read (boom).'] });
  });

  it('applyModuleImport validates, runs beforeSave first, and does not save when it fails', async () => {
    const prepared = gym.importers[0].prepare(FIXTURE, defaultData());
    const order = [];
    await applyModuleImport({ mod: gym, prepared, beforeSave: async () => order.push('backup'), save: async () => order.push('save') });
    expect(order).toEqual(['backup', 'save']);

    const save = vi.fn();
    await expect(applyModuleImport({ mod: gym, prepared, beforeSave: async () => { throw new Error('backup failed'); }, save })).rejects.toThrow('backup failed');
    expect(save).not.toHaveBeenCalled();
    await expect(applyModuleImport({ mod: gym, prepared: { ok: true, data: { broken: true } }, save })).rejects.toThrow(/Import stopped/);
    await expect(applyModuleImport({ mod: gym, prepared: { ok: false }, save })).rejects.toThrow(/Refusing/);
  });

  it('Settings shows the gainz card, and the "on this phone" button only when gainz data is here', async () => {
    const registry = createRegistry([gym]);
    const storage = await openStorage({ dbName: `gym-settings-${Math.random()}`, modules: registry.list() });
    const loaded = await storage.load(gym);
    const ctx = { registry, storage, state: { gym: { data: loaded.data, readOnly: false } } };
    const root = document.createElement('main');

    localStorage.removeItem(GAINZ_STATE_KEY);
    let cards = importerCards(root, ctx, () => {});
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Import from gainz-tracker');
    expect(cards[0].querySelector('[data-testid="import-gym-gainz-tracker-local"]')).toBeNull();

    localStorage.setItem(GAINZ_STATE_KEY, FIXTURE);
    localStorage.setItem('gainz_notion_token', 'secret_never_read');
    cards = importerCards(root, ctx, () => {});
    root.append(...cards);
    root.querySelector('[data-testid="import-gym-gainz-tracker-local"]').click();
    await vi.waitFor(() => expect(root.querySelector('[data-testid="module-import-summary"]')).not.toBeNull());
    expect(root.querySelector('[data-testid="module-import-summary"]').textContent).toContain('5 workouts');
    root.querySelector('[data-testid="module-import-apply"]').click();
    await vi.waitFor(() => expect(root.querySelector('[data-testid="module-import-done"]')).not.toBeNull());
    const stored = await storage.readAll([gym]);
    expect(stored.gym.data.workoutLogs).toHaveLength(5);
    expect(JSON.stringify(stored)).not.toContain('secret_never_read');
    localStorage.clear();
    storage.close();
  });
});
