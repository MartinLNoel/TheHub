# TheHub — Part 2: Core Shell (install, offline, updates, storage, Today, CI)

**Depends on:** Part 1
**Branch:** `part-2/core-shell`
**Estimated effort:** 2–3 sessions

---

## USER ACTIONS REQUIRED

- Part 1 done: both repos exist, Pages source is "GitHub Actions".

---

## Instructions for Claude

> **IMPORTANT:** Start Claude Code from the project directory:
> `C:\Users\marti\Documents\Education\TheHub`
>
> Copy everything below this box and paste it as your prompt to Claude.

---

### Prompt Start

You are building **TheHub**, Martin's personal multi-module phone app: an installable web app (PWA) in vanilla JS ES
modules, hosted on GitHub Pages at `https://martinlnoel.github.io/TheHub/`. This is **Part 2: the core shell**. No
module exists yet; this part builds everything the modules will stand on.

Read `CLAUDE.md`, `SPEC.md` and `docs/plans/part-0-overview.md` before starting. Part 0's folder layout, module
contract and storage rules are binding.

Create branch `part-2/core-shell` from `main`. Start the three logs now: `docs/BACKLOG.md` (where things stand, next
steps), `docs/CHANGELOG.md` (dated entries) and `docs/ROADMAP.md` (Parts 3–8 as headings, plus ideas), and remove
the "*(started when Part 1 begins)*" notes from `CLAUDE.md`'s map.

**Build:**

1. **Tooling.** `package.json` (dev only): Vitest with jsdom and `fake-indexeddb`, Playwright (Chromium, a mobile
   viewport around 412×915 like a Galaxy S-series), and a tiny static server for e2e. Scripts: `test`, `e2e`,
   `serve`. `.gitignore`: `node_modules/`, `private/`, Playwright reports.
2. **App shell.** `index.html`, `style.css`, `src/app.js`, `src/core/router.js` (hash routes `#/today`,
   `#/<module>/<screen>`). A header, a `<main id="screen">`, and a bottom nav built from the registry (Today + one tab
   per module). CSS tokens on `:root` with a dark theme via `prefers-color-scheme` and a manual toggle stored in
   core settings. Touch targets at least 48 px; use `rem` so the phone's font size is respected. All paths must be
   relative so the app works under `/TheHub/`.
3. **PWA.** `manifest.webmanifest` (name "TheHub", `start_url` and `scope` relative, `display: standalone`, theme
   colours, icons 192/512 plus maskable; generate simple placeholder icons). `shortcuts` for "Log workout"
   (`#/gym/log`), "Study" (`#/istqb`), "Scan item" (`#/fridge/scan`); routes that do not exist yet show a friendly
   "coming soon" screen.
4. **Service worker** `sw.js`: precache the app shell, cache-first for app files, network-first for `content/`. The
   cache name includes the version from `src/version.js`. `src/core/update.js`: when a new worker is waiting, show a
   banner "Update available — tap to refresh" that activates it and reloads.
5. **Storage** `src/core/db.js`: IndexedDB as in Part 0, the migrations runner (refuse to write when stored data is
   newer than the code), `navigator.storage.persist()` on first run, and a `beforeMigrate` hook that Part 3 will
   connect to backup (for now it calls a no-op the tests can observe).
6. **Registry and Today.** `src/core/registry.js` implements the module contract; `src/core/today.js` renders one
   card per registered module (from `todayCard`) and a placeholder "Backups: not set up yet" card. Add a tiny
   `demo` module **only under `tests/`** to exercise the contract; ship no real module.
7. **Export / import** `src/core/transfer.js`: export everything in the Part 0 backup format (with checksum) as a
   downloaded file; import a file after checking format, checksum and `validate`, with a confirmation screen showing
   what will be replaced. A Settings screen (`#/settings`) holds export, import and the theme toggle.
8. **CI and deploy** `.github/workflows/ci.yml`: on every push and pull request run `npm test` and `npm run e2e`; on
   `main` only, and only after both pass, deploy to Pages with `actions/upload-pages-artifact` +
   `actions/deploy-pages`, uploading only app files (not `tests/`, `docs/`, `node_modules/`). Add a check that fails
   when app files changed but `src/version.js` was not bumped.

**Tests (required):**
- Unit: migrations run in order; newer-data refusal; `beforeMigrate` runs before any migration; export → import
  round-trip is identical; a tampered export (checksum mismatch) is rejected; registry rejects a module missing
  required fields.
- E2E: the app loads at the phone viewport; nav works; Today shows the demo card (test build); the app reloads
  **offline** after a first visit; the update banner appears when a new service worker is waiting.

When done: all tests pass locally; update `docs/BACKLOG.md` and `docs/CHANGELOG.md`; commit in sensible steps; push
the branch and tell Martin how to merge it (or merge to `main` if he says so). Then give him the USER ACTIONS below.

### Prompt End

---

## USER ACTIONS after Claude finishes

1. Merge `part-2/core-shell` into `main` (or let Claude do it) and push.
2. On GitHub: **Actions** tab → wait for the green tick → open `https://martinlnoel.github.io/TheHub/`.
3. **Install it on the phone:** open that address in Chrome → menu (⋮) → **Add to home screen** / **Install app**.
4. Check: it opens full-screen from the icon; long-pressing the icon shows the three shortcuts; turning on
   aeroplane mode and reopening still works.

## What you have at the end of this part

An installed, offline-capable TheHub on your phone with a Today screen, settings, export/import and an update
banner, deployed only when tests pass. No modules yet.
