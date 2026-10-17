// Today screen: one card per registered module (from its todayCard), plus the backup status.
import { h, mount } from './dom.js';
import { relativeTime } from './backup.js';

function toHref(route) {
  if (!route) return '#/today';
  if (route.startsWith('#')) return route;
  return `#/${route.replace(/^\/+/, '')}`;
}

function moduleCard(mod, entry) {
  if (entry?.error) {
    return h(
      'section',
      { class: 'card card--warn', 'data-module': mod.id },
      h('h2', {}, `${mod.icon} ${mod.name}`),
      h('p', {}, entry.error),
    );
  }
  if (typeof mod.todayCard !== 'function') return null;
  let card;
  try {
    card = mod.todayCard(entry?.data);
  } catch (err) {
    return h(
      'section',
      { class: 'card card--warn', 'data-module': mod.id },
      h('h2', {}, `${mod.icon} ${mod.name}`),
      h('p', {}, `This card could not be shown: ${err.message}`),
    );
  }
  if (!card) return null;
  return h(
    'section',
    { class: 'card', 'data-module': mod.id },
    h('h2', {}, `${mod.icon} ${card.title || mod.name}`),
    (card.lines || []).map((line) => h('p', {}, line)),
    entry?.readOnly ? h('p', { class: 'muted' }, 'Read-only until the app updates.') : null,
    card.action ? h('a', { class: 'btn btn--primary', href: toHref(card.action.route) }, card.action.label) : null,
  );
}

/**
 * The Backups card. health comes from backup.js backupHealth(); onBackupNow() runs a backup and
 * re-renders. Without health (tests of other cards), it shows the "not set up" state.
 */
export function backupCard(health, { onBackupNow, now = Date.now() } = {}) {
  const hl = health || { state: 'never', configured: false, exportDue: true };
  const lines = [];
  let cls = 'card';
  if (!hl.configured) {
    lines.push(h('p', { 'data-testid': 'backup-line' }, 'Backups: not set up yet'));
    if (hl.last) lines.push(h('p', { class: 'muted' }, `Last verified backup: ${relativeTime(hl.last, now)}`));
  } else if (hl.state === 'never') {
    lines.push(h('p', { 'data-testid': 'backup-line' }, 'No verified backup yet.'));
  } else {
    const tick = hl.state === 'ok' ? ' ✓' : '';
    lines.push(h('p', { 'data-testid': 'backup-line' }, `Last verified backup: ${relativeTime(hl.last, now)}${tick}`));
  }
  if (hl.configured && hl.state === 'amber') {
    cls = 'card card--warn';
    lines.push(h('p', {}, 'More than 30 hours ago. It backs up the next time it can.'));
  }
  if (hl.configured && (hl.state === 'red' || hl.state === 'never')) cls = hl.state === 'red' ? 'card card--bad' : 'card card--warn';
  if (hl.failure) lines.push(h('p', { class: 'status--bad', 'data-testid': 'backup-failure' }, `Last backup failed: ${hl.failure.reason}`));
  if (hl.tokenWarning) lines.push(h('p', { class: 'status--bad', 'data-testid': 'token-warning' }, hl.tokenWarning));
  if (hl.exportDue) lines.push(h('p', { class: 'muted', 'data-testid': 'export-reminder' }, 'Monthly: export a copy to your phone as well.'));

  const busy = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const backupNow = hl.configured
    ? h(
        'button',
        {
          type: 'button',
          class: hl.state === 'ok' ? 'btn' : 'btn btn--primary',
          'data-testid': 'backup-now',
          onclick: async (event) => {
            event.currentTarget.disabled = true;
            busy.textContent = 'Backing up…';
            await onBackupNow?.();
          },
        },
        'Back up now',
      )
    : h('a', { class: 'btn btn--primary', href: '#/settings', 'data-testid': 'backup-setup' }, 'Set up backups');

  return h(
    'section',
    { class: cls, 'data-module': 'core-backup', 'data-state': hl.configured ? hl.state : 'not-set-up' },
    h('h2', {}, '🛟 Backups'),
    lines,
    h(
      'div',
      { class: 'row' },
      backupNow,
      hl.exportDue ? h('a', { class: 'btn', href: '#/settings', 'data-testid': 'export-link' }, 'Export a copy to your phone') : null,
    ),
    busy,
  );
}

/**
 * state: { [moduleId]: { data, readOnly, error } }
 * backup (optional): { health, onBackupNow } for the Backups card.
 */
export function renderToday(root, { registry, state, backup = {} }) {
  const cards = registry.list().map((mod) => moduleCard(mod, state[mod.id])).filter(Boolean);
  mount(
    root,
    h(
      'div',
      { class: 'stack', 'data-testid': 'today' },
      cards.length ? cards : h('section', { class: 'card' }, h('h2', {}, 'Welcome'), h('p', {}, 'No modules yet. They arrive with the next updates.')),
      backupCard(backup.health, { onBackupNow: backup.onBackupNow }),
    ),
  );
}
