import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../src/core/registry.js';
import { renderToday } from '../../src/core/today.js';
import { applyTheme } from '../../src/core/settings.js';
import demo from '../fixtures/demo-module.js';

describe('Today screen', () => {
  it("shows one card per module from its todayCard, plus the backup placeholder", () => {
    const root = document.createElement('main');
    renderToday(root, { registry: createRegistry([demo]), state: { demo: { data: { notes: [{ text: 'a' }] } } } });
    const card = root.querySelector('[data-module="demo"]');
    expect(card.textContent).toContain('Demo');
    expect(card.textContent).toContain('1 notes');
    expect(card.querySelector('a').getAttribute('href')).toBe('#/demo');
    expect(root.querySelector('[data-module="core-backup"]').textContent).toContain('Backups: not set up yet');
  });

  it('shows a module error instead of its card', () => {
    const root = document.createElement('main');
    renderToday(root, { registry: createRegistry([demo]), state: { demo: { data: null, error: 'broken data' } } });
    expect(root.querySelector('[data-module="demo"]').textContent).toContain('broken data');
  });

  it('renders module text as text, never as HTML', () => {
    const evil = { ...demo, todayCard: () => ({ title: '<img src=x onerror=alert(1)>', lines: ['<b>x</b>'] }) };
    const root = document.createElement('main');
    renderToday(root, { registry: createRegistry([evil]), state: { demo: { data: {} } } });
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
  });
});

describe('theme', () => {
  it('forces light or dark, and follows the phone for system', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
