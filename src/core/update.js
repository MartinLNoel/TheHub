// Service worker registration and the "Update available" banner.
// A new version installs in the background and waits; the banner lets Martin switch to it.

import { h } from './dom.js';

export const BANNER_TEXT = 'Update available — tap to refresh';

// Set when Martin taps the banner; the page reloads once the new worker has taken over.
const state = { updateRequested: false };

function showBanner(registration, doc) {
  if (doc.getElementById('update-banner')) return;
  const banner = h(
    'button',
    {
      id: 'update-banner',
      class: 'update-banner',
      type: 'button',
      onclick: () => {
        banner.disabled = true;
        banner.textContent = 'Updating…';
        state.updateRequested = true;
        const waiting = registration.waiting;
        if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
        else doc.defaultView.location.reload();
      },
    },
    BANNER_TEXT,
  );
  doc.body.append(banner);
}

/** Registers sw.js and wires up the update banner. Returns the registration (or null). */
export async function registerUpdates({ doc = globalThis.document, nav = globalThis.navigator } = {}) {
  if (!nav?.serviceWorker) return null;
  const sw = nav.serviceWorker;
  const win = doc.defaultView;

  let reloading = false;
  sw.addEventListener('controllerchange', () => {
    // The first install also claims the page; reload only for an update Martin asked for.
    if (!state.updateRequested || reloading) return;
    reloading = true;
    win.location.reload();
  });

  const registration = await sw.register('./sw.js', { scope: './' });

  const watch = (worker) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && sw.controller) showBanner(registration, doc);
    });
  };

  if (registration.waiting && sw.controller) showBanner(registration, doc);
  watch(registration.installing);
  registration.addEventListener('updatefound', () => watch(registration.installing));

  // Look for a new version whenever the app comes back to the foreground.
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') registration.update().catch(() => {});
  });
  return registration;
}
