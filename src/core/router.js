// Hash router: #/today, #/settings, #/settings/<screen>, #/<module>, #/<module>/<screen>.
// Hash routes keep every path relative, so the app works under /TheHub/ on GitHub Pages.

export const DEFAULT_ROUTE = '#/today';

/** Parses a location hash into { section, screen }. section is 'today', 'settings' or a module id. */
export function parseHash(hash) {
  const path = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  if (!parts.length) return { section: 'today', screen: '' };
  return { section: parts[0], screen: parts.slice(1).join('/') };
}

export function routeHref(section, screen = '') {
  return screen ? `#/${section}/${screen}` : `#/${section}`;
}

/**
 * Starts the router. onRoute({ section, screen }) runs for the current hash and on every change.
 * Returns { navigate(hash), stop() }.
 */
export function startRouter(onRoute, win = globalThis.window) {
  const handle = () => onRoute(parseHash(win.location.hash));
  win.addEventListener('hashchange', handle);
  if (!win.location.hash) win.history.replaceState(null, '', DEFAULT_ROUTE);
  handle();
  return {
    navigate(hash) {
      if (win.location.hash === hash) handle();
      else win.location.hash = hash;
    },
    stop: () => win.removeEventListener('hashchange', handle),
  };
}

/**
 * Finds a module's route for a screen: an exact key first ('log', 'history'), else a parameter route
 * '<first>/*' for '<first>/<rest>' (e.g. 'lesson/*' for 'lesson/3.1'), with params = '<rest>'.
 * Returns { render, params } or null.
 */
export function resolveRoute(routes, screen = '') {
  if (!routes) return null;
  if (typeof routes[screen] === 'function') return { render: routes[screen], params: '' };
  const slash = screen.indexOf('/');
  if (slash > 0) {
    const wild = routes[`${screen.slice(0, slash)}/*`];
    if (typeof wild === 'function') return { render: wild, params: screen.slice(slash + 1) };
  }
  return null;
}
