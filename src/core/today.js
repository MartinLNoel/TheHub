// Today screen, laid out like a phone's home screen (2026-11-15, Martin: "a background with app icons on it like a
// phone home page"): the time and date, a grid of app icons (every module, then Settings), then each module's
// Today card and the backup status as widgets.
import { h, mount } from './dom.js';
import { relativeTime } from './backup.js';
import { NO_HUB } from './hub.js';
import { marketStatus } from './markets.js';

function toHref(route) {
  if (!route) return '#/today';
  if (route.startsWith('#')) return route;
  return `#/${route.replace(/^\/+/, '')}`;
}

function moduleCard(mod, entry, hub = NO_HUB) {
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
    card = mod.todayCard(entry?.data, { hub });
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

/** The colour of each app's icon (a module without one gets the default). */
export const APP_COLORS = {
  gym: '#f06a3a',
  istqb: '#3c7fd6',
  bulgarian: '#2f9e5a',
  fridge: '#22a6c4',
  settings: '#6b7280',
  demo: '#8a5cf6',
};
const DEFAULT_COLOR = '#5b6270';

function appIcon({ id, name, icon, href }) {
  const color = APP_COLORS[id] || DEFAULT_COLOR;
  return h(
    'a',
    { class: 'app-icon', href, 'data-app': id, style: `--app:${color}` },
    h('span', { class: 'app-icon__tile', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'app-icon__label' }, name),
  );
}

const two = (n) => String(n).padStart(2, '0');

/** The big clock at the top; it updates itself while it is on screen. */
function clock(now = () => new Date()) {
  const time = h('div', { class: 'home__time' });
  const date = h('div', { class: 'home__date' });
  const tick = () => {
    const d = now();
    time.textContent = `${two(d.getHours())}:${two(d.getMinutes())}`;
    date.textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  tick();
  const timer = setInterval(() => {
    if (!time.isConnected) clearInterval(timer);
    else tick();
  }, 15000);
  return h('div', { class: 'home__clock', 'aria-hidden': 'true' }, time, date);
}

/**
 * A module's short line under the clock (homeStatus, e.g. the Gym's weather): drawn at once, then updated if its
 * refresh brings something newer. A module whose homeStatus fails shows nothing rather than breaking the home.
 */
function statusLine(mod, entry) {
  if (typeof mod.homeStatus !== 'function') return null;
  let status;
  try {
    status = mod.homeStatus(entry?.data);
  } catch {
    return null;
  }
  if (!status || !status.text) return null;
  const attrs = { class: 'home__status', 'data-testid': `home-status-${mod.id}` };
  const node = status.href ? h('a', { ...attrs, href: status.href }, status.text) : h('p', attrs, status.text);
  if (typeof status.refresh === 'function') {
    Promise.resolve()
      .then(() => status.refresh())
      .then((next) => {
        if (next?.text && node.isConnected) node.textContent = next.text;
      })
      .catch(() => {});
  }
  return node;
}

/**
 * A module's tile in the "today" strip (homeTile: { title, text, sub, href, refresh? }), in the module's colour.
 * Like the status lines, a failing tile is left out and a refresh fills it in later (the Bulgarian word).
 */
function tile(mod, entry, hub) {
  if (typeof mod.homeTile !== 'function') return null;
  let t;
  try {
    t = mod.homeTile(entry?.data, { hub });
  } catch {
    return null;
  }
  if (!t || !t.text) return null;
  const text = h('span', { class: 'home-tile__text' }, t.text);
  const sub = h('span', { class: 'home-tile__sub' }, t.sub || '');
  const node = h(
    'a',
    { class: 'home-tile', href: t.href || `#/${mod.id}`, style: `--app:${APP_COLORS[mod.id] || DEFAULT_COLOR}`, 'data-testid': `home-tile-${mod.id}` },
    h('span', { class: 'home-tile__title' }, h('span', { 'aria-hidden': 'true' }, mod.icon), ` ${t.title || mod.name}`),
    text,
    sub,
  );
  if (typeof t.refresh === 'function') {
    Promise.resolve()
      .then(() => t.refresh())
      .then((next) => {
        if (!next?.text || !node.isConnected) return;
        text.textContent = next.text;
        sub.textContent = next.sub || '';
      })
      .catch(() => {});
  }
  return node;
}

/** The market session clock (src/core/markets.js); it updates itself while it is on screen. */
export function marketCard(now = () => new Date()) {
  const rows = h('ul', { class: 'markets__rows' });
  const overlap = h('p', { class: 'markets__overlap', 'data-testid': 'markets-overlap' });
  const draw = () => {
    const m = marketStatus(now());
    mount(
      rows,
      m.sessions.map((s) =>
        h(
          'li',
          { class: `markets__row${s.isOpen ? ' markets__row--open' : ''}`, 'data-testid': `market-${s.id}` },
          h('span', { class: 'markets__name' }, h('span', { 'aria-hidden': 'true' }, s.flag), ` ${s.name}`),
          h('span', { class: 'markets__state' }, s.text),
        ),
      ),
    );
    overlap.textContent = m.overlap ? '🔥 London and New York overlap: the busiest hours.' : '';
    overlap.hidden = !m.overlap;
  };
  draw();
  const card = h(
    'section',
    { class: 'card markets', 'data-module': 'core-markets', 'data-testid': 'markets' },
    h('h2', {}, '🕒 Market sessions'),
    rows,
    overlap,
    h('p', { class: 'muted markets__note' }, 'Usual forex session hours, in each city\u2019s own time.'),
  );
  const timer = setInterval(() => {
    if (!card.isConnected) clearInterval(timer);
    else draw();
  }, 30000);
  return card;
}

/**
 * state: { [moduleId]: { data, readOnly, error } }
 * backup (optional): { health, onBackupNow } for the Backups card.
 */
export function renderToday(root, { registry, state, backup = {}, hub = NO_HUB }) {
  const mods = registry.list();
  const cards = mods.map((mod) => moduleCard(mod, state[mod.id], hub)).filter(Boolean);
  const statuses = mods.map((mod) => statusLine(mod, state[mod.id])).filter(Boolean);
  const tiles = mods.map((mod) => tile(mod, state[mod.id], hub)).filter(Boolean);
  const apps = [
    ...mods.map((m) => ({ id: m.id, name: m.name, icon: m.icon, href: `#/${m.id}` })),
    { id: 'settings', name: 'Settings', icon: '⚙️', href: '#/settings' },
  ];
  mount(
    root,
    h(
      'div',
      { class: 'home stack', 'data-testid': 'today' },
      clock(),
      statuses.length ? h('div', { class: 'home__statuses' }, statuses) : null,
      h('nav', { class: 'home__apps', 'aria-label': 'Apps', 'data-testid': 'home-apps' }, apps.map(appIcon)),
      h('h2', { class: 'home__heading' }, 'Today'),
      tiles.length ? h('nav', { class: 'home-strip', 'aria-label': 'Today at a glance', 'data-testid': 'home-strip' }, tiles) : null,
      marketCard(),
      cards.length ? cards : h('section', { class: 'card' }, h('h2', {}, 'Welcome'), h('p', {}, 'No modules yet. They arrive with the next updates.')),
      backupCard(backup.health, { onBackupNow: backup.onBackupNow }),
    ),
  );
}
