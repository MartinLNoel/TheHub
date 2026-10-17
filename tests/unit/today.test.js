import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../src/core/registry.js';
import { backupCard, renderToday } from '../../src/core/today.js';
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

describe('Backups card', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const ago = (h) => new Date(now - h * 3600_000).toISOString();
  const render = (health, opts) => {
    const root = document.createElement('main');
    root.append(backupCard(health, { now, ...opts }));
    return root.querySelector('[data-module="core-backup"]');
  };

  it('not set up: links to Settings', () => {
    const card = render({ state: 'never', configured: false, exportDue: true });
    expect(card.dataset.state).toBe('not-set-up');
    expect(card.textContent).toContain('Backups: not set up yet');
    expect(card.querySelector('[data-testid="backup-setup"]').getAttribute('href')).toBe('#/settings');
  });

  it('ok: shows the relative time and a tick', () => {
    const card = render({ state: 'ok', configured: true, last: ago(3), exportDue: false });
    expect(card.dataset.state).toBe('ok');
    expect(card.textContent).toContain('Last verified backup: 3 hours ago ✓');
    expect(card.querySelector('[data-testid="export-reminder"]')).toBeNull();
  });

  it('amber and red, with the failure reason, token warning and export reminder', () => {
    expect(render({ state: 'amber', configured: true, last: ago(31) }).className).toContain('card--warn');
    const red = render({
      state: 'red',
      configured: true,
      last: ago(50),
      failure: { reason: 'GitHub refused the token (401)' },
      tokenWarning: 'The backup token expires in 3 days',
      exportDue: true,
    });
    expect(red.className).toContain('card--bad');
    expect(red.textContent).not.toContain('✓');
    expect(red.querySelector('[data-testid="backup-failure"]').textContent).toContain('401');
    expect(red.querySelector('[data-testid="token-warning"]').textContent).toContain('3 days');
    expect(red.querySelector('[data-testid="export-link"]').textContent).toBe('Export a copy to your phone');
  });

  it('"Back up now" calls the backup', async () => {
    let called = 0;
    const card = render({ state: 'red', configured: true, last: ago(50) }, { onBackupNow: async () => called++ });
    card.querySelector('[data-testid="backup-now"]').click();
    expect(called).toBe(1);
  });
});
