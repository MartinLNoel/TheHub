# TheHub — Changelog

Dated entries, newest first.

## 2026-10-17 — Part 2: core shell (version 0.2.0)

Built autonomously while Martin was away, on branch `part-2/core-shell`, merged into local `main` (not pushed).

- **Tooling:** `package.json` (dev only) with Vitest + jsdom + fake-indexeddb, Playwright (Chromium, 412×915 phone
  viewport) and `yaml` (to check the CI file); `scripts/serve.mjs`, a dependency-free static server that serves the
  app under `/TheHub/` like GitHub Pages.
- **App shell:** `index.html`, `style.css` (light/dark tokens, manual theme toggle, 48 px targets, `rem` sizes),
  `src/app.js`, hash router, bottom nav built from the registry, "coming soon" screen for routes not built yet.
- **PWA:** `manifest.webmanifest` (relative `start_url`/`scope`, standalone, 192/512/maskable placeholder icons,
  shortcuts Log workout / Study / Scan item); `sw.js` (precache, cache-first app files, network-first `content/`,
  versioned cache); update banner "Update available — tap to refresh".
- **Storage:** `src/core/db.js` — IndexedDB with one store per module, migrations runner, refusal to write data newer
  than the code, `beforeMigrate` hook (no-op until Part 3), `navigator.storage.persist()` on first run.
- **Registry and Today:** module contract checks; Today renders each module's card plus a "Backups: not set up yet"
  placeholder. A demo module exists only under `tests/fixtures/`.
- **Export / import:** Part 0 backup format with SHA-256 checksum; import verifies format, checksum, migrations and
  `validate`, then shows what will be replaced before writing. Settings screen holds theme, export and import.
- **CI:** `.github/workflows/ci.yml` — version-bump check, unit and e2e tests on every push and PR; deploy to Pages
  (app files only) on `main` after the tests pass. Not yet run on GitHub.
- **Tests:** 68 unit tests, 11 e2e tests, all passing locally.
- **Docs:** started BACKLOG, CHANGELOG and ROADMAP; Part 0 updated (module list in `src/modules.js`, route context,
  new core files); QUESTIONS Q-5 and Q-6 added.
