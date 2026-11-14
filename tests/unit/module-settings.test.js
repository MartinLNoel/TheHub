// Modules can add a card to Settings (settingsCard): the core renders it and saves through the module's checks.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from '../../src/core/dom.js';
import { moduleSettingsCards } from '../../src/core/settings.js';
import { checkModule } from '../../src/core/registry.js';
import demo from '../fixtures/demo-module.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function ctxFor(mod, entry) {
  const saved = [];
  return { saved, ctx: { registry: { list: () => [mod] }, state: { [mod.id]: entry }, storage: { save: vi.fn(async (m, d) => saved.push(d)) } } };
}

describe('module settings cards', () => {
  beforeEach(() => document.body.replaceChildren());

  it('a module may leave it out or give a function, nothing else', () => {
    expect(checkModule({ ...demo, settingsCard: undefined })).toEqual([]);
    expect(checkModule({ ...demo, settingsCard: () => null })).toEqual([]);
    expect(checkModule({ ...demo, settingsCard: {} })).toContain('settingsCard must be a function (or left out)');
  });

  it("renders the card with a copy of the data; save validates, saves and updates the app's copy", async () => {
    let api;
    const mod = { ...demo, settingsCard: (a) => { api = a; return h('section', { 'data-testid': 'demo-card' }, 'Demo'); } };
    const entry = { data: demo.defaultData(), readOnly: false };
    const { saved, ctx } = ctxFor(mod, entry);
    const cards = moduleSettingsCards(ctx);
    expect(cards).toHaveLength(1);
    expect(api.data).toEqual(entry.data);
    expect(api.data).not.toBe(entry.data);
    const next = demo.defaultData();
    await api.save(next);
    expect(saved).toEqual([next]);
    expect(entry.data).toBe(next);
  });

  it('refuses invalid data and read-only data, saving nothing', async () => {
    let api;
    const mod = { ...demo, validate: () => ['broken'], settingsCard: (a) => { api = a; return null; } };
    const { saved, ctx } = ctxFor(mod, { data: demo.defaultData(), readOnly: false });
    expect(moduleSettingsCards(ctx)).toHaveLength(0);
    await expect(api.save({})).rejects.toThrow('broken');
    const ro = ctxFor({ ...demo, settingsCard: (a) => { api = a; return null; } }, { data: demo.defaultData(), readOnly: true });
    moduleSettingsCards(ro.ctx);
    await expect(api.save(demo.defaultData())).rejects.toThrow('cannot be changed until the app updates');
    expect(saved).toEqual([]);
    expect(ro.saved).toEqual([]);
  });

  it('a card that throws becomes a warning, not a broken Settings screen', () => {
    const mod = { ...demo, settingsCard: () => { throw new Error('boom'); } };
    const { ctx } = ctxFor(mod, { data: demo.defaultData(), readOnly: false });
    const [card] = moduleSettingsCards(ctx);
    expect(card.textContent).toContain('This card could not be shown: boom');
  });

  it('no card for a module whose data did not load', () => {
    const { ctx } = ctxFor({ ...demo, settingsCard: () => h('p', {}, 'x') }, { data: null, error: 'failed' });
    expect(moduleSettingsCards(ctx)).toEqual([]);
  });
});
