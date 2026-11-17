# TheHub — Part 0: Architecture Overview

> This is a reference document. No code is written in this part. Every later part's prompt says to read it first.
> If a part changes something described here, update this file in the same commit.

---

## How the system works

```
                        GitHub (free)
   ┌──────────────────────────────┬──────────────────────────────┐
   │ MartinLNoel/TheHub (public)  │ MartinLNoel/thehub-backup    │
   │  code + lesson content       │  (private) one JSON file,    │
   │  push → CI tests → Pages     │  one commit per backup       │
   └──────────────┬───────────────┴───────────────▲──────────────┘
                  │ app files                     │ GitHub REST API
                  ▼                               │ (fine-grained token)
   ┌──────────────────────────────────────────────┴──────────────┐
   │ Martin's phone — TheHub installed from Chrome               │
   │   service worker (offline cache, update banner)             │
   │   core: storage · backup · Today · registry · export/import │
   │   modules: gym · istqb · bulgarian · fridge                 │
   │   IndexedDB: one store per module + core store              │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ "Ask Claude" (share / link)
                                  ▼
                       Claude app (Martin's subscription)
```

Claude Code sessions on Martin's PC write content and code, and read the backup repo when they need his feedback
and wrong answers (the content loop).

---

## Folder layout

```
TheHub/
├── index.html               app shell: header, <main id="screen">, bottom nav
├── manifest.webmanifest     name, icons, theme, shortcuts
├── sw.js                    service worker (must sit at the root for scope); VERSION + PRECACHE list
├── style.css                global tokens (light/dark) and shared components
├── icons/
├── src/
│   ├── app.js               boots core, registers modules, routes
│   ├── version.js           the app version (bump with every app change; sw.js repeats it)
│   ├── modules.js           the list of shipped modules, in nav order
│   ├── core/
│   │   ├── dates.js         local calendar dates (YYYY-MM-DD), addDays, daysBetween, isCalendarDate (not the Gym yet, Q-11)
│   │   ├── db.js            IndexedDB wrapper + migrations runner
│   │   ├── dom.js           tiny h()/mount() helper (text is always text, never HTML)
│   │   ├── hub.js           hub.offer(target, item) / hub.accepts(target): cross-module offers (Part 8)
│   │   ├── diagnostics.js   Settings → Diagnostics: the phone's BarcodeDetector formats, camera (Part 8),
│   │   │                    whether a bg-BG speech voice exists (Part 7)
│   │   ├── registry.js      module registry
│   │   ├── router.js        hash routes: #/today, #/gym/log, ...
│   │   ├── screens.js       "coming soon" and error screens
│   │   ├── settings.js      Settings screen: theme, export, import
│   │   ├── speech.js        speechSynthesis helpers: findVoice, the 🔊 button (shown only when a voice for the
│   │   │                    language exists), the Diagnostics voice line (Part 7)
│   │   ├── today.js         Today screen
│   │   ├── backup.js        build, verify, upload, read back, schedule, restore (the backup service)
│   │   ├── backup-screens.js Settings → Backup card and the Restore screen (#/settings/restore)
│   │   ├── github.js        GitHub REST calls for the backup repo (the only code that sends the token)
│   │   ├── transfer.js      export / import of everything as a file
│   │   ├── module-import.js Settings cards for module importers (e.g. Gym's "Import from gainz-tracker")
│   │   ├── update.js        service worker registration + banner
│   │   └── study/           shared study engine (Part 5): index.js (createStudyModule), content.js (validate,
│   │                        load), markdown.js, progress.js (review queue, mastery, feedback), session.js,
│   │                        mock.js, scheduler.js (SM-2), ask-claude.js, screens.js; README.md = its API
│   └── modules/
│       ├── gym/             Part 4: index.js (module), program.js (gainz program data, unchanged), logic.js
│       │                    (gainz rules as pure functions), data.js (store + validate), screens.js,
│       │                    fighter.js (the SVG character), import.js (gainz-tracker import)
│       ├── istqb/           Part 6: index.js (createStudyModule config, Today card, importer), rules.js
│       │                    (official weighting, chapters X/6, readiness gate, 10-day warm-up), import.js
│       │                    ("Import ISTQB progress"), screens.js (home summary, wrong-answer review)
│       ├── bulgarian/       Part 7 (built before the book, 2026-10-18): index.js (createStudyModule config,
│       │                    accept, Today card), data.js (trainer progress, streak, rounds, transliteration,
│       │                    the "From my home" deck), content.js (alphabet/reading loading and checks),
│       │                    screens.js (home, alphabet, practice rounds)
│       └── fridge/          Part 8: index.js (module, Today card), data.js (store, validate, expiry rules,
│                            offline lookup queue), barcode.js (EAN/UPC checks), off.js (Open Food Facts),
│                            scanner.js (camera + BarcodeDetector or the vendored fallback), screens.js
│   └── vendor/              third-party files copied unchanged (no build step), each folder with a README
│                            (version, SHA-256, licences): barcode-detector/ (Part 8, zxing-wasm scanner)
├── content/
│   ├── istqb/               index.json (manifest) · objectives.json (64 LOs) · lessons-ch3..6.json ·
│   │                        questions-ch1..6.json · cards.json · handled-feedback.json (docs/istqb-content-guide.md)
│   └── bulgarian/           index.json (manifest: empty chapters/lessons/questions/cards until the book) ·
│                            alphabet.json (30 letters) · reading.json (reading words) (docs/bulgarian-content-guide.md)
├── tests/
│   ├── unit/                Vitest (jsdom + fake-indexeddb)
│   ├── e2e/                 Playwright, mobile viewport (412×915, Galaxy size)
│   └── fixtures/            the demo module, the sample study course and module (sample-course/,
│                            sample-study-module.js) and a fake GitHub API (tests only, never shipped)
├── scripts/                 serve.mjs (static server at /TheHub/), make-icons.mjs, check-version-bump.mjs,
│                            istqb-import.mjs (Notion extract → private/istqb-progress.json, Part 6)
├── private/                 GIT-IGNORED: imports, exports, local notes
├── .github/workflows/       ci.yml: test, then deploy to Pages
├── package.json             dev tooling only
├── SPEC.md  CLAUDE.md
└── docs/  BACKLOG.md CHANGELOG.md ROADMAP.md plans/
```

---

## The module contract

Every module exports one object from `src/modules/<id>/index.js` and is listed in `src/modules.js`
(Part 2 moved the list there from `src/app.js`, so the e2e test build can swap in a demo module):

```js
export default {
  id: 'gym',                    // also its IndexedDB store name and route prefix
  name: 'Gym',
  icon: '🏋️',
  schemaVersion: 1,
  migrations: {                 // from version N-1 to N; pure functions, each tested
    // 2: (data) => ({ ...data, newField: [] })
  },
  defaultData: () => ({ /* fresh data */ }),
  validate: (data) => [],       // returns a list of problems; [] means complete (used by backup verify)
  routes: { '': renderHome, 'log': renderLog, 'lesson/*': renderLesson },
                                // #/gym, #/gym/log; '' is required; 'x/*' matches #/<id>/x/<anything> (Part 5)
  todayCard: (data, { hub }) => ({ title, lines: [], action: { label, route } }), // or null; may be left out
  hidden: true,                  // optional (0.9.12): no app icon and no nav tab (the pet lives on the home screen)
  homeWidget: ({ data, readOnly, hub, save }) => Node | null, // optional (0.9.12): its own widget on the home screen,
                                // after the app icons, with a save for its data
  homeTile: (data, { hub }) => ({ title, text, sub, href, refresh? }) | null, // optional (0.9.11): a tile in the home
                                // screen's "today" strip, in the module's colour
  homeStatus: (data) => ({ text, href?, refresh? }) | null, // optional (0.9.7): a short line under the home clock;
                                // refresh() resolves to a newer { text } (the Gym's weather)
  accept: (item, data) => newData | null, // optional (Part 8): take an item another module offers (below)
  answers: { question: (data, ...args) => value }, // optional (0.9.8): read-only answers for hub.ask (below)
  onStart: async ({ hub }) => {},  // optional (0.9.8): once after the data is loaded (and after a restore)
  settingsCard: ({ data, readOnly, save }) => Node | null, // optional (2026-11-14): a card in Settings; save(next) validates and saves
  importers: [                  // optional (Part 4): bring data in from another app, shown in Settings
    { id, title, description, prepare: (text, currentData) => ({ ok, problems, summary, data, nothingNew }),
      findLocal: () => text | null, localLabel }   // findLocal/localLabel optional
  ],
};
```

An importer's `prepare` maps and merges but never writes. The core (`src/core/module-import.js`) shows its
`summary`, takes a verified backup first when backups are set up (a failed backup stops the import), checks the
result with the module's `validate`, then saves it as the module's data. Gym's routes: `''` and `log` (the workout
to log, the "Log workout" shortcut), `history`, `fighter`, `protein`, `checkin`.

Each route function is called as `render({ root, data, readOnly, save, navigate, settings, params, hub })`: `root` is the `<main>` element
to fill, `data` the module's current data, `save(newData)` stores it (and rejects with `NewerDataError` when the
stored data is newer than the code), `navigate('#/gym/log')` changes screen, `settings` is the core settings (read-only copy: theme, `askClaude`),
`params` is what a `'x/*'` route matched (`'3.1'` for `#/istqb/lesson/3.1`), else `''` (Part 5; exact keys win,
`src/core/router.js` `resolveRoute`), `hub` is the cross-module offer API below (Part 8). An action `route` may be `'gym/log'`
or `'#/gym/log'`. The registry (`src/core/registry.js`) rejects a module that breaks this contract.

The core never reaches into a module's data except through `validate`, `migrations`, `defaultData` and `accept`.
Modules never touch another module's store; cross-module features (Fridge → Bulgarian cards) go through a small
core API, `hub.offer(targetModuleId, item)` (`src/core/hub.js`, built in Part 8), which the target module accepts
or ignores:
- `hub.accepts(id)`: true when a module with that id is installed, has `accept`, and its data is writable. The
  Fridge asks this first and shows its "Learn the Bulgarian name" prompt only then.
- `hub.offer(id, item)` resolves (never throws) to `{ accepted: true }` or `{ accepted: false, reason }` with reason
  `no-module` (not installed: the Fridge before Part 7), `not-accepting`, `declined` (`accept` returned `null`,
  e.g. a duplicate), `invalid` (the result failed the target's `validate`) or `error`.
- The target's `accept(item, data)` is pure: it gets copies and returns its new data (or `null`); the core checks it
  with `validate`, saves it and updates the live state.
- `hub.ask(id, question, ...args)` (0.9.8) is the read-only side: it calls the target's `answers[question]` with a
  copy of its data and returns the value, or `null` when anything is missing; it never throws. Questions so far: the
  Fridge answers `foodDay(date)` (the day's food log and totals) and `kcalTarget()`; the Gym answers `bodyweight()`,
  `proteinTarget()` and `foodArchive()` (its protein log from before 0.9.8). Since 0.9.12 the Gym, ISTQB, Bulgarian and
  Fridge also answer `activities()` (`[{ id, kind, date }]`: workouts, study sessions, practice days, food days), the
  pet's meals.
- Items offered so far: the Fridge offers `{ bg, en, topic: 'food' }` to `bulgarian` (`bg` typed or confirmed by
  Martin, prefilled from Open Food Facts' Bulgarian name when there is one; `en` = the English product name or the
  item's name). Part 7's `accept` (built 2026-10-18) adds it to the "From my home" deck and returns `null` for a word already there.

---

## Storage

- One IndexedDB database `thehub`. Store `core` holds settings and backup status; one store per module holds a
  single document `{ schemaVersion, data, updatedAt }`.
- Load: if the stored `schemaVersion` is older than the module's, **back up first** (Part 3 connects
  `hooks.beforeMigrate` in `src/core/db.js` to a verified GitHub backup), then run each migration in order and save. If it is newer (an old app version opened newer data), refuse to write and show a message.
- Ask Chrome for persistent storage (`navigator.storage.persist()`), so Android does not evict the data.

---

## Backup file format

```json
{
  "format": "thehub-backup",
  "formatVersion": 1,
  "createdAt": "2026-10-17T08:12:00Z",
  "appVersion": "1.4.0",
  "modules": {
    "gym":   { "schemaVersion": 1, "data": { } },
    "istqb": { "schemaVersion": 1, "data": { } }
  },
  "sha256": "<hex of the canonical JSON of `modules`>"
}
```

- Stored in `thehub-backup` as `backup.json`, overwritten each time; **git history is the archive**. Restoring "a past
  day" means fetching `backup.json` at an older commit.
- **Verify** (before a backup counts as good, and before any restore): recompute the checksum, run the migrations on
  a copy, run each module's `validate`, and check the item counts match the live data. Only then record
  "last verified backup".
- The same format is used for the export file.
- The core store holds `backupToken` (only ever sent to `api.github.com`), `backupConfig` (owner, repo, token
  expiry), `backupStatus` (`lastVerifiedBackup`, `lastCommit`, `lastFailure`, `lastAutoAttemptAt`) and
  `lastExportAt`. Backups and exports contain module stores only, never the core store.
- When: on start and on return to the foreground if the last verified backup is over 24 hours old (at most once
  per 10 minutes); before any migration (`hooks.beforeMigrate`: a failed backup blocks the migration); before an
  import or a restore; and on "Back up now".

---

## Study engine data (Part 5)

A study module is made with `createStudyModule(config)` (`src/core/study/index.js`; its API for module authors is
`src/core/study/README.md`). Shapes as built in Part 5 (fields marked *new* were added to the Part 0 draft):

Content (shipped in the repo, `content/<module>/`, every file listed in `PRECACHE`; CI validates them all).
*Part 6:* a course may split each kind over several files listed in a manifest (`contentManifest`, e.g.
`content/istqb/index.json` `{ lessons: [...], questions: [...], cards: [...] }`), concatenated in order:
- `lessons.json`: `{ id, chapter, section, title, objectives: ["FL-3.1.1"], body (markdown subset) }`; file order is
  course order.
- `questions.json`: `{ id, objective, kLevel, stem, options: [4 texts, A–D], answer: "A"–"D", why,
  distractorNotes: { <each wrong letter>: text }, source: "generated", chapter?, difficulty? }`. *New:* optional
  `chapter` (required when no lesson teaches the objective, e.g. ISTQB Ch1–2) and `difficulty` 1–3.
- `cards.json`: `{ id, front, back, topic, twoWay, lang?: { front, back }, objective? }`. *New:* optional `lang`;
  ids must not contain `~`.

Progress (per module, in IndexedDB and backups; schema version 1):
- `mastery`: `{ [objective]: "untested" | "shaky" | "solid" | "exam-ready" }` (missing = untested)
- `reviewQueue`: `[{ id, questionId?, objective?, note?, addedSession, dueSession, step, correctCount }]`: 1 / 3 / 7
  session intervals, leaves after 2 correct in a row (as in the tutor prompt)
- `attempts`: every answered question `{ questionId, objective, chosen, correct, at, sessionNo, kind }` (the
  wrong-answer log; *new:* `objective`, `kind` = drill | quiz | retrieval | mock; `chosen` is null for a mock
  question left unanswered; imports may add `legacyText`)
- `sessions`: `{ no, date (the local calendar day, `src/core/dates.js`), section, score, correct, total, kind: "lesson" | "mini-mock" | "full-mock", … }`
  (`section` = lesson id, or the mock's config id; `score` = percent; lesson sessions add `calibration`, `complete`;
  mocks add `elapsedMs`, `timedOut`)
- `feedback`: `{ id, targetId, targetKind?, text, at, resolved: false }` (*new:* `id` for the content loop,
  `targetKind` = lesson | question | card)
- `pointer`: id of the next lesson (`null` = the first, `"__done__"` after the last)
- *new:* `cardState`: `{ [cardId or cardId~rev]: { reps, interval, ef, due, lapses, last, first } }` (SM-2)
- *new:* `activeSession`, `activeMock`: the session or timed mock in progress (or `null`), so stopping never loses work
- *Part 6:* imported sessions and attempts carry `imported: true`; an imported lesson session may list its own
  `objectives` (its lesson is not in the course), which delayed retrieval uses; `legacy.importId` makes a
  re-import a no-op. A session step may carry a `label` (e.g. "Warm-up"). A `"__done__"` pointer resumes when
  lessons are added after the last one studied.

Core settings gain `askClaude`: `"share"` (default) | `"link"` | `"copy"` (Settings → Ask Claude).

---

## Bulgarian data (Part 7)

Study progress (above) plus, schema version 1 (the full comment is in `src/modules/bulgarian/data.js`):
`alphabet` `{ [letterId]: { toSound?, toLetter? } }` and `reading` `{ [wordId]: … }`, each `{ right, wrong, streak }`;
`activity` (local days with practice or card reviews, for the streak); `homeDeck` (the "From my home" cards:
`{ id: "home-<n>", front: bg, back: en, topic, twoWay: true, lang: { front: "bg", back: "en" }, deck: "home",
added }`). `accept` declines (null) an item whose Bulgarian word is already a card (case, spacing and Unicode form
ignored), or that has no Cyrillic `bg` or no `en`.

## Fridge data (Part 8)

Schema version 1, text only (no photos); the full comment is in `src/modules/fridge/data.js`:
- `items`: `{ id, name, brand, location: "fridge" | "freezer" | "pantry", quantity (text), expiry ("YYYY-MM-DD" local
  calendar date, or null), added (local date), barcode (string or null), lookup ("pending" or null), nameAuto }`.
  `lookup: "pending"` is the offline queue: a barcode scanned without network is saved (with the stand-in name
  "Barcode <code>" if Martin typed none) and looked up when the Fridge opens online, or with "Look up now".
- `waste`: `{ used, thrown }` counts. `products`: Open Food Facts answers by barcode (`{ name, brand, nameEn,
  nameBg, fetchedAt }`), so a product scanned before is filled in offline.
- Lookups: `GET https://world.openfoodfacts.org/api/v2/product/<code>?fields=…&app_name=TheHub&app_version=…`
  (a browser cannot set `User-Agent`; Q-20). Scanning: the phone's `BarcodeDetector` when it reads EAN-13, else the
  vendored `barcode-detector` ponyfill (zxing-wasm) from `src/vendor/`, never a CDN.

## Tests and deploy

- `npm test` runs Vitest unit tests; `npm run e2e` runs Playwright against a local static server at a phone
  viewport.
- `.github/workflows/ci.yml`: on push to `main`, run both; only if they pass, deploy the repo's app files to GitHub
  Pages with the official Pages actions. On other branches: tests only.
- The service worker's cache name includes the app version from `src/version.js` (repeated as a constant at the top
  of `sw.js`, because a byte change in `sw.js` is what makes the phone see an update; a unit test keeps them equal); CI fails if a commit changes app
  files without bumping it (so the phone always sees updates).
