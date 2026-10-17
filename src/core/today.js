// Today screen: one card per registered module (from its todayCard), plus the backup status.
import { h, mount } from './dom.js';

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

function backupCard() {
  // PART 3 replaces this with the real "Last verified backup: <time> ✓" card.
  return h(
    'section',
    { class: 'card', 'data-module': 'core-backup' },
    h('h2', {}, '🛟 Backups'),
    h('p', {}, 'Backups: not set up yet'),
    h('a', { class: 'btn', href: '#/settings' }, 'Export a copy'),
  );
}

/** state: { [moduleId]: { data, readOnly, error } } */
export function renderToday(root, { registry, state }) {
  const cards = registry.list().map((mod) => moduleCard(mod, state[mod.id])).filter(Boolean);
  mount(
    root,
    h(
      'div',
      { class: 'stack', 'data-testid': 'today' },
      cards.length ? cards : h('section', { class: 'card' }, h('h2', {}, 'Welcome'), h('p', {}, 'No modules yet. They arrive with the next updates.')),
      backupCard(),
    ),
  );
}
