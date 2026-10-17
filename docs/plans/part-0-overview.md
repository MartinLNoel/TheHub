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
│   │   ├── backup.js        build, checksum, verify, upload, restore
│   │   ├── github.js        GitHub REST calls for the backup repo
│   │   ├── transfer.js      export / import of everything as a file
│   │   ├── update.js        service worker registration + banner
│   │   └── study/           shared study engine (Part 5)
│   └── modules/
│       ├── gym/             Part 4
│       ├── istqb/           Part 6
│       ├── bulgarian/       Part 7
│       └── fridge/          Part 8
├── content/
│   ├── istqb/               lessons + question bank (JSON, Martin's own text)
│   └── bulgarian/
├── tests/
│   ├── unit/                Vitest (jsdom + fake-indexeddb)
│   ├── e2e/                 Playwright, mobile viewport (412×915, Galaxy size)
│   └── fixtures/            the demo module (tests only, never shipped)
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
  routes: { '': renderHome, 'log': renderLog },   // #/gym, #/gym/log; '' is required
  todayCard: (data) => ({ title, lines: [], action: { label, route } }) // or null; may be left out
};
```

Each route function is called as `render({ root, data, readOnly, save, navigate })`: `root` is the `<main>` element
to fill, `data` the module's current data, `save(newData)` stores it (and rejects with `NewerDataError` when the
stored data is newer than the code), `navigate('#/gym/log')` changes screen. An action `route` may be `'gym/log'`
or `'#/gym/log'`. The registry (`src/core/registry.js`) rejects a module that breaks this contract.

The core never reaches into a module's data except through `validate`, `migrations` and `defaultData`. Modules never
touch another module's store; cross-module features (Fridge → Bulgarian cards) go through a small core API,
`hub.offer(targetModuleId, item)`, which the target module accepts or ignores.

---

## Storage

- One IndexedDB database `thehub`. Store `core` holds settings and backup status; one store per module holds a
  single document `{ schemaVersion, data, updatedAt }`.
- Load: if the stored `schemaVersion` is older than the module's, **back up first**, then run each migration in order
  and save. If it is newer (an old app version opened newer data), refuse to write and show a message.
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

---

## Study engine data (Part 5)

Content (shipped in the repo, `content/<module>/`):
- `lessons.json`: `{ id, chapter, section, title, objectives: ["FL-3.1.1"], body (markdown subset) }`
- `questions.json`: `{ id, objective, kLevel, stem, options: [A–D], answer, why, distractorNotes, source: "generated" }`
- `cards.json`: `{ id, front, back, topic, twoWay }`

Progress (per module, in IndexedDB and backups):
- `mastery`: `{ [objective]: "untested" | "shaky" | "solid" | "exam-ready" }`
- `reviewQueue`: spaced review items with next-due session (1 / 3 / 7 session intervals, as in the tutor prompt)
- `attempts`: every answered question `{ questionId, chosen, correct, at, sessionNo }` (this is the wrong-answer log)
- `sessions`: `{ no, date, section, score, kind: "lesson" | "mini-mock" | "full-mock" }`
- `feedback`: `{ targetId, text, at, resolved: false }`
- `pointer`: next section to study

---

## Tests and deploy

- `npm test` runs Vitest unit tests; `npm run e2e` runs Playwright against a local static server at a phone
  viewport.
- `.github/workflows/ci.yml`: on push to `main`, run both; only if they pass, deploy the repo's app files to GitHub
  Pages with the official Pages actions. On other branches: tests only.
- The service worker's cache name includes the app version from `src/version.js` (repeated as a constant at the top
  of `sw.js`, because a byte change in `sw.js` is what makes the phone see an update; a unit test keeps them equal); CI fails if a commit changes app
  files without bumping it (so the phone always sees updates).
