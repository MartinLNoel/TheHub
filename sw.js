// TheHub service worker: offline cache and updates.
// VERSION must equal src/version.js (a unit test checks it). Bumping it changes this file's bytes,
// which is how the phone notices a new version.
const VERSION = '0.5.0';
const CACHE = `thehub-${VERSION}`;

// The app shell, cached on install. Every file under src/ (except README.md), icons/ and content/
// must be listed (a unit test checks it), so the app opens offline after the first visit.
const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/app.js',
  'src/version.js',
  'src/modules.js',
  'src/core/backup.js',
  'src/core/backup-screens.js',
  'src/core/db.js',
  'src/core/dom.js',
  'src/core/github.js',
  'src/core/module-import.js',
  'src/core/registry.js',
  'src/core/router.js',
  'src/core/screens.js',
  'src/core/settings.js',
  'src/core/today.js',
  'src/core/transfer.js',
  'src/core/update.js',
  'src/core/study/ask-claude.js',
  'src/core/study/content.js',
  'src/core/study/index.js',
  'src/core/study/markdown.js',
  'src/core/study/mock.js',
  'src/core/study/progress.js',
  'src/core/study/scheduler.js',
  'src/core/study/screens.js',
  'src/core/study/session.js',
  'src/modules/gym/data.js',
  'src/modules/gym/fighter.js',
  'src/modules/gym/import.js',
  'src/modules/gym/index.js',
  'src/modules/gym/logic.js',
  'src/modules/gym/program.js',
  'src/modules/gym/screens.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // No skipWaiting here: an update waits until Martin taps the banner.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('thehub-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const scopePath = new URL(self.registration.scope).pathname;

function isContent(url) {
  return url.pathname.startsWith(`${scopePath}content/`);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function navigation(request) {
  // Every page is the one app shell; routes live in the hash.
  const cache = await caches.open(CACHE);
  const shell = (await cache.match('index.html')) || (await cache.match('./'));
  if (shell) return shell;
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return;

  if (request.mode === 'navigate') event.respondWith(navigation(request));
  else if (isContent(url)) event.respondWith(networkFirst(request));
  else event.respondWith(cacheFirst(request));
});
