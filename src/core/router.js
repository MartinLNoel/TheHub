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
