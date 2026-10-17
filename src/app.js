// Boots the core: registry, storage, theme, nav, router and updates.
import { VERSION } from './version.js';
import modules from './modules.js';
import { createRegistry } from './core/registry.js';
import { NewerDataError, openStorage, requestPersistence } from './core/db.js';
import { startRouter } from './core/router.js';
import { h, mount } from './core/dom.js';
import { renderToday } from './core/today.js';
import { applyTheme, loadSettings, renderSettings } from './core/settings.js';
import { renderComingSoon, renderProblem } from './core/screens.js';
import { registerUpdates } from './core/update.js';

const screen = document.getElementById('screen');
const nav = document.getElementById('nav');
const title = document.getElementById('title');

const registry = createRegistry(modules);
const state = {}; // { [moduleId]: { data, readOnly, error } }
let storage;
let router;

async function loadAll() {
  for (const mod of registry.list()) {
    try {
      const result = await storage.load(mod);
      state[mod.id] = { data: result.data, readOnly: result.status === 'newer' };
      if (result.status === 'newer') {
        state[mod.id].error = `${mod.name}: this data comes from a newer version of TheHub. Update the app; nothing is saved until then.`;
      }
    } catch (err) {
      state[mod.id] = { data: null, readOnly: true, error: `${mod.name} could not load its data: ${err.message}` };
    }
  }
}

function buildNav() {
  const tabs = [
    { section: 'today', icon: '🏠', name: 'Today' },
    ...registry.list().map((m) => ({ section: m.id, icon: m.icon, name: m.name })),
  ];
  mount(
    nav,
    tabs.map((t) =>
      h(
        'a',
        { href: `#/${t.section}`, class: 'tab', 'data-section': t.section },
        h('span', { class: 'tab__icon', 'aria-hidden': 'true' }, t.icon),
        h('span', { class: 'tab__label' }, t.name),
      ),
    ),
  );
}

function markActive(section) {
  for (const tab of nav.querySelectorAll('.tab')) {
    if (tab.dataset.section === section) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}

async function route({ section, screen: sub }) {
  markActive(section);
  window.scrollTo(0, 0);
  if (section === 'today') {
    title.textContent = 'Today';
    return renderToday(screen, { registry, state });
  }
  if (section === 'settings') {
    title.textContent = 'Settings';
    if (sub) return renderComingSoon(screen, { section, screen: sub });
    return renderSettings(screen, {
      storage,
      registry,
      state,
      appVersion: VERSION,
      reloadData: loadAll,
      navigate: (hash) => router.navigate(hash),
    });
  }
  const mod = registry.get(section);
  title.textContent = mod ? mod.name : 'TheHub';
  const render = mod?.routes[sub];
  if (!mod || !render) return renderComingSoon(screen, { section, screen: sub });
  const entry = state[mod.id];
  if (entry?.error && entry.data === null) return renderProblem(screen, mod.name, entry.error);

  // The context every module screen receives (see the module contract in part-0-overview.md).
  return render({
    root: screen,
    data: entry.data,
    readOnly: entry.readOnly,
    save: async (data) => {
      try {
        await storage.save(mod, data);
        entry.data = data;
      } catch (err) {
        if (err instanceof NewerDataError) entry.readOnly = true;
        throw err;
      }
    },
    navigate: (hash) => router.navigate(hash),
  });
}

async function boot() {
  try {
    storage = await openStorage({ modules: registry.list() });
  } catch (err) {
    renderProblem(screen, 'TheHub could not open its storage', err.message);
    return;
  }
  const settings = await loadSettings(storage);
  applyTheme(settings.theme);
  requestPersistence(storage).catch(() => {});
  await loadAll();
  buildNav();
  router = startRouter((r) => {
    Promise.resolve(route(r)).catch((err) => renderProblem(screen, 'Something went wrong', err.message));
  });
  document.documentElement.dataset.ready = 'true';
  registerUpdates().catch((err) => console.warn('Service worker registration failed:', err));
}

boot();
