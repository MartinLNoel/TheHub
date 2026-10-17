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
│   │   ├── db.js            IndexedDB wrapper + migrations runner
│   │   ├── dom.js           tiny h()/mount() helper (text is always text, never HTML)
│   │   ├── registry.js      module registry
│   │   ├── router.js        hash routes: #/today, #/gym/log, ...
│   │   ├── screens.js       "coming soon" and error screens
│   │   ├── settings.js      Settings screen: theme, export, import
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
│       ├── istqb/           Part 6
│       ├── bulgarian/       Part 7
│       └── fridge/          Part 8
├── content/
│   ├── istqb/               lessons + question bank (JSON, Martin's own text)
│   └── bulgarian/
├── tests/
│   ├── unit/                Vitest (jsdom + fake-indexeddb)
│   ├── e2e/                 Playwright, mobile viewport (412×915, Galaxy size)
│   └── fixtures/            the demo module, the sample study course and module (sample-course/,
│                            sample-study-module.js) and a fake GitHub API (tests only, never shipped)
├── scripts/                 serve.mjs (static server at /TheHub/), make-icons.mjs, check-version-bump.mjs
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
  todayCard: (data) => ({ title, lines: [], action: { label, route } }), // or null; may be left out
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

Each route function is called as `render({ root, data, readOnly, save, navigate, settings, params })`: `root` is the `<main>` element
to fill, `data` the module's current data, `save(newData)` stores it (and rejects with `NewerDataError` when the
stored data is newer than the code), `navigate('#/gym/log')` changes screen, `settings` is the core settings (read-only copy: theme, `askClaude`),
`params` is what a `'x/*'` route matched (`'3.1'` for `#/istqb/lesson/3.1`), else `''` (Part 5; exact keys win,
`src/core/router.js` `resolveRoute`). An action `route` may be `'gym/log'`
or `'#/gym/log'`. The registry (`src/core/registry.js`) rejects a module that breaks this contract.

The core never reaches into a module's data except through `validate`, `migrations` and `defaultData`. Modules never
touch another module's store; cross-module features (Fridge → Bulgarian cards) go through a small core API,
`hub.offer(targetModuleId, item)`, which the target module accepts or ignores.

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

Content (shipped in the repo, `content/<module>/`, every file listed in `PRECACHE`; CI validates them all):
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
- `sessions`: `{ no, date, section, score, correct, total, kind: "lesson" | "mini-mock" | "full-mock", … }`
  (`section` = lesson id, or the mock's config id; `score` = percent; lesson sessions add `calibration`, `complete`;
  mocks add `elapsedMs`, `timedOut`)
- `feedback`: `{ id, targetId, targetKind?, text, at, resolved: false }` (*new:* `id` for the content loop,
  `targetKind` = lesson | question | card)
- `pointer`: id of the next lesson (`null` = the first, `"__done__"` after the last)
- *new:* `cardState`: `{ [cardId or cardId~rev]: { reps, interval, ef, due, lapses, last, first } }` (SM-2)
- *new:* `activeSession`, `activeMock`: the session or timed mock in progress (or `null`), so stopping never loses work

Core settings gain `askClaude`: `"share"` (default) | `"link"` | `"copy"` (Settings → Ask Claude).

---

## Tests and deploy

- `npm test` runs Vitest unit tests; `npm run e2e` runs Playwright against a local static server at a phone
  viewport.
- `.github/workflows/ci.yml`: on push to `main`, run both; only if they pass, deploy the repo's app files to GitHub
  Pages with the official Pages actions. On other branches: tests only.
- The service worker's cache name includes the app version from `src/version.js` (repeated as a constant at the top
  of `sw.js`, because a byte change in `sw.js` is what makes the phone see an update; a unit test keeps them equal); CI fails if a commit changes app
  files without bumping it (so the phone always sees updates).
