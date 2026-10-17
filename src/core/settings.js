// Settings screen (#/settings): theme, export and import.
import { h, mount } from './dom.js';
import { applyImport, countItems, downloadJSON, exportAll, readImport } from './transfer.js';

export const THEMES = ['system', 'light', 'dark'];

/** Applies a theme choice: 'system' follows the phone, 'light'/'dark' force it. */
export function applyTheme(theme, doc = globalThis.document) {
  const root = doc.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

export async function loadSettings(storage) {
  return { theme: 'system', ...((await storage.getCore('settings')) || {}) };
}

export async function saveSettings(storage, settings) {
  await storage.setCore('settings', settings);
}

function formatCounts(counts) {
  const parts = Object.entries(counts).map(([k, n]) => `${k}: ${n}`);
  return parts.length ? parts.join(', ') : 'no items';
}

/**
 * ctx: { storage, registry, appVersion, state, reloadData(), navigate(hash) }
 */
export async function renderSettings(root, ctx) {
  const settings = await loadSettings(ctx.storage);
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });

  const themeButtons = THEMES.map((t) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg',
        'data-theme-choice': t,
        'aria-pressed': String(settings.theme === t),
        onclick: async () => {
          settings.theme = t;
          await saveSettings(ctx.storage, settings);
          applyTheme(t);
          themeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === t)));
        },
      },
      t[0].toUpperCase() + t.slice(1),
    ),
  );

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    id: 'import-file',
    'data-testid': 'import-file',
    onchange: async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const verified = await readImport(await file.text(), ctx.registry);
      fileInput.value = '';
      if (!verified.ok) {
        mount(status, h('strong', {}, 'Import refused. '), verified.problems.join(' '));
        status.className = 'status status--bad';
        return;
      }
      renderConfirm(root, ctx, verified);
    },
  });

  mount(
    root,
    h(
      'div',
      { class: 'stack', 'data-testid': 'settings' },
      h('section', { class: 'card' }, h('h2', {}, 'Theme'), h('div', { class: 'segmented', role: 'group', 'aria-label': 'Theme' }, themeButtons)),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Export and import'),
        h('p', {}, 'Export saves everything to one file on this phone. Import replaces data with a file you exported before.'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary',
            'data-testid': 'export',
            onclick: async () => {
              const file = await exportAll(ctx.storage, ctx.registry, ctx.appVersion);
              downloadJSON(file);
              status.className = 'status';
              status.textContent = 'Export saved to your downloads.';
            },
          },
          'Export everything',
        ),
        h('label', { class: 'btn', for: 'import-file' }, 'Import a file…'),
        fileInput,
        status,
      ),
      h('p', { class: 'muted' }, `TheHub version ${ctx.appVersion}`),
    ),
  );
}

function renderConfirm(root, ctx, verified) {
  const rows = Object.entries(verified.modules).map(([id, m]) => {
    const mod = ctx.registry.get(id);
    const current = ctx.state[id]?.data;
    return h(
      'li',
      { 'data-module': id },
      h('strong', {}, `${mod.icon} ${mod.name}`),
      h('br'),
      `Now: ${formatCounts(countItems(current))}`,
      h('br'),
      `From file: ${formatCounts(m.counts)}`,
    );
  });
  const when = verified.createdAt ? new Date(verified.createdAt).toLocaleString() : 'unknown date';

  mount(
    root,
    h(
      'section',
      { class: 'card card--warn', 'data-testid': 'import-confirm' },
      h('h2', {}, 'Replace data?'),
      h('p', {}, `This file was made on ${when}. Importing replaces the current data of:`),
      h('ul', { class: 'list' }, rows),
      verified.skipped.length
        ? h('p', { class: 'muted' }, `Not imported (not in this app version): ${verified.skipped.join(', ')}.`)
        : null,
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--danger',
            'data-testid': 'import-confirm-button',
            onclick: async () => {
              await applyImport(ctx.storage, verified);
              await ctx.reloadData();
              mount(
                root,
                h(
                  'section',
                  { class: 'card', 'data-testid': 'import-done' },
                  h('h2', {}, 'Import done'),
                  h('p', {}, 'Your data was replaced with the file.'),
                  h('a', { class: 'btn btn--primary', href: '#/today' }, 'Go to Today'),
                ),
              );
            },
          },
          'Replace',
        ),
        h('button', { type: 'button', class: 'btn', onclick: () => renderSettings(root, ctx) }, 'Cancel'),
      ),
    ),
  );
}
