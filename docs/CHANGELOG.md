# TheHub — Changelog

Dated entries, newest first.

## 2026-10-17 — Part 4: Gym module (version 0.4.0)

Built autonomously while Martin was away, on branch `part-4/gym`, merged into local `main` (not pushed). The two
gainz Notion pages (coaching guide, app spec) were read, read-only; they agree with gainz-tracker's `app.js`.

- **gainz-tracker (Step 1):** on its local branch `export-button` (commit c476b99, based on its `main` ea0373b; not
  merged, not pushed): a visible **"⬇ Export all data (JSON)"** button on Check-in, next to "Restore from JSON
  file", calling the existing `exportBackup()`. Checked by running the app in jsdom: the export holds `state` only
  (workoutLogs, dayIndex, _mondayFixed, personalBests, proteinLogs, checkIns, phase, bodyweight, myFoods, and
  lastSeenStage once the Fighter tab was opened), never `gainz_notion_token`. Nothing else changed there.
- **Gym module (`src/modules/gym/`):** Workout (gainz "Today": GYM/HOME, sets pre-filled from the last time that day
  was logged, personal bests, rest timer, Phase 2 prompt after 18 sessions), History (gainz "Log", with personal
  bests), Fighter (10 stages, the evolving SVG character copied unchanged, power state at a 3-week streak, stage
  preview by arrows, swipe or list, unlock toast and jump), Protein (ring, quick add, My Foods, one-off, today's log,
  bodyweight), Check-in (stats, weekly check-in, history with weight change, coach notes). The program data
  (`PROGRAM`, `WORKOUTS`, `HOME_WORKOUTS`, `QUICK_FOODS`, `STAGES`) is copied unchanged into `program.js`, and a unit
  test compares it with gainz-tracker's `app.js`. The rules are pure functions in `logic.js`.
- **Data:** schema version 1, the same fields as gainz `state` minus `_mondayFixed`; gainz's one-time date fix and
  its Notion backup are dropped (TheHub's backups replace it). `validate`: every workout has a real date and
  exercises, counts are 0 or more, dates parse.
- **Decision: gainz's "pre-load historical workout data if starting fresh" block is not kept.** gainz-tracker ran
  it whenever its list was empty and saved the result, so an export from the phone already holds those 7 sessions
  (Feb to May 2026). A fresh TheHub would otherwise show sessions before the import, and the data is personal, which
  the public repo must not hold. A fresh Gym starts empty; the history comes from the import. Martin to confirm
  with his real export (QUESTIONS Q-10).
- **Today card:** the planned workout ("Rest day" once the week's target is met, "Done today. Next: …" after a
  session), sessions this week vs target, protein left today, streak; "Log workout" opens `#/gym/log`, as does the
  manifest shortcut.
- **Import from gainz-tracker (Settings):** reads the gainz export, maps and **merges** it into the Gym (it adds,
  never deletes): workouts by id (by content when there is none), protein items and check-ins by content (counted,
  so two identical shakes on a day stay two), saved foods by name and grams, the better personal best; Phase 2 is
  never undone. Preview: workouts, protein days, check-ins and fighter stage in the file, what is new, and the
  result. A verified TheHub backup is taken first when backups are set up (a failure stops the import). Importing
  the same file again says "Nothing to import". When gainz-tracker runs on the same address
  (`martinlnoel.github.io`), a button reads its data straight from the phone (only `gainz_state`).
- **Core:** optional `importers` in the module contract (checked by the registry; `src/core/module-import.js`
  renders them in Settings); an unknown screen of a shipped module now says "no screen" instead of "coming soon".
- **Tests:** 182 unit tests and 28 e2e tests, all passing locally. New: parity with gainz-tracker's original
  functions (copied unchanged into `tests/fixtures/gainz-original.js`) over generated histories and many "today"s
  (streak, next day, sessions this week, stage, protein, pre-fill); mapping and double import with a **synthetic**
  export (`tests/fixtures/gainz-export.synthetic.json`, never the real file); `validate`; e2e: log a workout and see
  it on Today and in History, protein, check-in, the import (twice, from a file, from the phone's storage, with a
  backup first and stopped when it fails).
- **Docs:** Part 0 (gym files, `importers`), QUESTIONS Q-2 (what was found), Q-10 (pre-load decision), Q-11 (UTC
  date and Sunday-week quirks kept on purpose), Q-12 (tab names and other port choices).

## 2026-10-17 — Part 3: verified backup and restore (version 0.3.0)

Built autonomously while Martin was away, on branch `part-3/backup`, merged into local `main` (not pushed). GitHub
was never called: every test uses a mocked `fetch` (`tests/fixtures/fake-github.js`).

- **`src/core/github.js`:** the only GitHub calls: read `backup.json` (latest or at a commit; raw fallback over
  1 MB), list its commits, write it with the current `sha` (re-read and retry once on a conflict), test connection.
  Clear errors for 401, 403 (incl. rate limit), 404, offline, conflict and a moved repo. Owner/repo configurable
  (defaults `MartinLNoel` / `thehub-backup`) and validated.
- **`src/core/backup.js`:** build → verify (checksum, migrations on a copy, `validate`, item counts equal to live
  data) → upload → read back at the new commit → verify again; only then `lastVerifiedBackup`. Automatic on start
  and on return to the foreground when over 24 hours old, at most once per 10 minutes; before every migration
  (`hooks.beforeMigrate`; a failure blocks the migration); before an import; and from "Back up now". Restore:
  verify, safety backup first, then replace (old backups are migrated).
- **`src/core/backup-screens.js`:** Settings → Backup (masked token, expiry date, repository, Test connection, Back
  up now, Remove token) and `#/settings/restore` (history, per-module preview, confirm).
- **Today "Backups" card:** not set up / never / ok ✓ / amber after 30 h / red after 48 h or a failure (with the
  reason and Back up now); token-expiry warning 14 days ahead; monthly export reminder.
- **Security:** the token is sent only to `https://api.github.com` in the `Authorization` header (origin checked
  before every request, `redirect: 'manual'`, `credentials: 'omit'`, no referrer, `no-store`); never in a URL,
  message, log, backup or export (`assertNoSecret` checks both).
- **Tests:** 110 unit tests and 17 e2e tests, all passing locally.
- **Docs:** Part 0 layout and backup notes; QUESTIONS Q-7 (shared Pages origin), Q-8 (migrations blocked without
  backups), Q-9 (export reminder interval, restore list length).

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
