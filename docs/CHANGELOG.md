# TheHub — Changelog

Dated entries, newest first.

## 2026-10-18 — Part 6 content run: Chapter 4 (version 0.6.2)

Written autonomously while Martin was away, on branch `content/istqb-ch4`, merged into local `main` (not pushed).
All content in our own words; no official sample-exam questions.

- **Lessons (6):** §4.1 (the three technique families), §4.2 split into `4.2a` (EP with spec-based valid/invalid
  partitions, Each Choice, 2-value and 3-value BVA) and `4.2b` (decision tables, state transition diagrams and
  tables, the three coverage criteria), §4.3 (statement and branch coverage, the value of white-box testing),
  §4.4 (error guessing and fault attacks, session-based exploratory testing, checklists), §4.5 (user stories,
  acceptance criteria, ATDD). Every worked example has its working written out; game examples throughout.
- **Questions:** 118 for Chapter 4 (6 to 12 per objective; EP 12, BVA 11, decision tables 10, state transitions
  11, ATDD 10). Correct answers spread A 29 · B 30 · C 30 · D 29. Every K3 answer, coverage percentage and lesson
  example was recomputed with a throwaway script (not committed), and each key re-read for a single correct
  option. 3-value BVA questions name the boundary values they mean (the open-range count is read two ways).
- **Flashcards:** 36 new (83 in all): technique terms, partitions, BVA variants, decision-table notation, state
  transition criteria, coverage, experience-based and collaboration terms, four list cards.
- **Tests:** the ≥ 6 questions per objective check now runs for Chapter 4; new checks: ≥ 10 for each Ch4 K3
  objective, lessons in course order with §4.1 right after §3.2; lesson ids may carry a part letter (`4.2a`).
- Q-17 updated: §3.2 → §4.1 is fixed by the file order; the gap moved to §4.5 → §6.1 until the Ch5 run.
- New open question Q-18: a pre-existing UTC/local date mismatch in study sessions (one e2e test fails between
  local midnight and 02:00; passes in UTC; fails the same on the base commit). Not fixed in this content run.

## 2026-10-17 — Part 6 content run: Chapters 3 and 6 (version 0.6.1)

Written autonomously while Martin was away, on branch `content/istqb-ch3-ch6`, merged into local `main` (not
pushed). All content in our own words; no official sample-exam questions.

- **Lessons:** §3.2 (stakeholder feedback, the five review activities, the six roles, the four review types, success
  factors), §6.1 (tool categories with game-QA examples) and §6.2 (automation benefits and risks, key phrases for
  exact-wording drilling). §3.1 kept, with one line on the low effort of static analysis. Lesson examples differ
  from the question scenarios.
- **Questions:** Ch3 from 9 to 55, Ch6 22 (6 to 12 per objective; extra for review roles and types, tool
  categories and automation benefits/risks). Correct answers spread A 20 · B 18 · C 19 · D 20.
- **Flashcards:** 25 new (47 in all): review terms and roles, tool categories, automation wording, lists.
- **Tests:** the ≥ 6 questions per objective check now runs for Chapters 3 and 6; the mnemonic ban in stems also
  covers the new review-process mnemonic.
- New open question: Q-17 (lesson order until the Ch4 and Ch5 lessons exist).

## 2026-10-17 — Part 6a: ISTQB module, progress import, content scaffolding (version 0.6.0)

Built autonomously while Martin was away, on branch `part-6/istqb`, merged into local `main` (not pushed). Paused
once by Martin mid-run (work saved as a WIP commit) and resumed. Notion was read only (no page created or changed).

- **Progress import (Step 1):** read the CTFL v4 Session States database (the newest state pages), the Legacy Analysis, the Exam Style Guide, the Official Question Pool Index and the
  Upgrade Spec. Their content went into a private extract (`private/istqb-notion-extract.json`);
  `scripts/istqb-import.mjs` converts it into the engine's progress and writes `private/istqb-progress.json` in
  the backup format (checksum verified). Both git-ignored, never committed. A Style Guide summary, the Legacy
  emphasis lists, the terminology list and Martin's trap log are in `private/istqb-notes.md`.
- **Module (`src/modules/istqb/`):** on `createStudyModule`. Home summary (Chapters X/6, readiness level and
  gate, next step, warm-up note, mastery by chapter, wrong answers); sessions in the tutor format; Chapter 3–6
  mini-mocks (10 questions: 7 + 3 cumulative, 15 min); the full mock (40 questions / 60 min, Ch1:8 Ch2:6 Ch3:4
  Ch4:11 Ch5:9 Ch6:2); the readiness gate (two consecutive complete full mocks ≥ 80 %); a chapter is banked by
  its mini-mock at ≥ 65 %; after more than 10 days the next session opens with a 5-question cumulative warm-up;
  wrong-answer review (imported answers keep their text) with "Retry my wrong answers"; flashcards; feedback with
  `handled-feedback.json`; Today card; the Study shortcut now opens it; Settings → **Import ISTQB progress**
  (refuses to overwrite study done in TheHub, re-import is a no-op, keeps TheHub feedback and cards).
- **Content scaffolding (`content/istqb/`):** a manifest (`index.json`) with per-chapter files, `objectives.json`
  (all 64 LOs, 14 K1 · 42 K2 · 8 K3, titles in our own words), the example lesson §3.1 with 9 questions, 22
  terminology and mnemonic flashcards, empty files for the later runs.
- **Engine:** content manifests (`contentManifest`), hooks `adjustSession` and `homeCards`, step `label`s carried
  into the debrief, a `"__done__"` pointer resumes when lessons are added later, imported lesson sessions may list
  their `objectives` for delayed retrieval.
- **Docs:** `docs/istqb-content-guide.md` (house style, copyright rules, layout), `docs/content-loop.md` (procedure
  and ready-to-paste prompt, also for the content runs), both linked from `CLAUDE.md`.
- **Tests:** objectives (64; 14/42/8; per chapter), shipped content rules (K-level, chapter, file, no mnemonic in
  stems), ≥ 6 questions per objective (pending until the content runs finish), official full-mock weighting,
  mini-mock split, chapters banked, readiness gate, 10-day warm-up, next step, the Notion import on a synthetic
  fixture, the in-app importer, Today card and home summary, manifest loading. E2E: import, a session, the
  Chapter 3 mini-mock and the full mock, wrong-answer review, phone fit. An existing backup e2e test now polls
  for the commit instead of reading it once (it raced).

## 2026-10-17 — Part 5: shared study engine (version 0.5.0)

Built autonomously while Martin was away, on branch `part-5/study-engine`, merged into local `main` (not pushed).
Read the ISTQB tutor prompt (v2) as the specification for the engine's rules.

- **Engine (`src/core/study/`):** `createStudyModule(config)` turns a course config into a normal module (contract
  checked), with screens for home, session, lessons, lesson reader, mocks, flashcards and the Feedback list. API for
  module authors: `src/core/study/README.md`.
- **Content loader:** validates lessons, questions and cards (four different options, a letter answer, a note for
  every distractor and none for the answer, K-levels, objectives taught by a lesson unless the question names its
  chapter, unique ids); `tests/unit/study-content.test.js` checks every course under `content/`, and at runtime
  bad items are dropped and listed, never fatal.
- **Lesson reader:** safe markdown subset (headings, lists, bold, italic, code, simple tables) rendered as text
  nodes; objective chips with K-level and mastery.
- **Question runner:** four options, "Select ONE option."; before submission the DOM holds only the stem and options
  (unit-tested for every sample question); afterwards the correct option, why, and why each distractor is wrong.
  Every answer is recorded the moment it is given.
- **Session builder:** the tutor prompt's format: drill from due review items → next lesson → quiz on its
  objectives → 1–2 delayed-retrieval questions from lessons at least two sessions back → debrief (binary score,
  calibration, mastery changes, next pointer). Past wrong answers and shaky objectives come first; questions
  answered correctly twice come last. Stop at any point: the session is kept and resumes where it stopped; "Finish
  now" debriefs what was done. Below 65 % the lesson is taught again (Q-14).
- **Spaced review:** wrong → next session, then +3, then +7; leaves after two correct in a row. **Mastery:**
  untested / shaky / solid / exam-ready (rule in Q-14).
- **Mocks:** N questions, a time limit, optional per-chapter counts (filled from other chapters if short), no
  feedback until the end; the timer is `endsAt − now` from stored timestamps, so it is right after the screen locks
  and a mock that ran out ends itself; debrief per objective and per chapter, then a full review.
- **Flashcards:** SM-2 (again/hard/good/easy), two-way cards scheduled per direction, large text with `lang` set;
  Cyrillic tested in jsdom and the browser.
- **Ask Claude:** on every lesson, answered question and card; the message holds course, section, objective,
  question and options, Martin's answer and the correct one, and ends with "My question: ". Delivery per Settings →
  Ask Claude: share sheet (default, "Copy instead" next to it), link `claude.ai/new?q=` (undocumented, off unless
  chosen), or copy and open the Claude app. Test buttons for all three in Settings. Not yet tried on the phone
  (Q-13).
- **Feedback:** `{ id, targetId, targetKind, text, at, resolved }` in the course's progress (so in backups); a
  Feedback list per course with open and resolved notes, "Mark resolved"/"Reopen", and a `handledFeedback` hook
  for Part 6's content loop.
- **Core:** parameter routes (`'lesson/*'` matches `#/<id>/lesson/<x>`, `resolveRoute` in `router.js`); module
  screens also get `settings` and `params`; core settings gain `askClaude`; generic `.toast` and study styles in
  `style.css`; the precache test now also requires every file under `content/` (READMEs excluded).
- **Tests:** a sample course (`tests/fixtures/sample-course/`, with Cyrillic cards) and module
  (`tests/fixtures/sample-study-module.js`), in the e2e build only. Unit: content validation, SM-2 intervals,
  1/3/7 queue, mastery, session builder (due items, delayed retrieval, priorities, pointer), mock timer and
  scoring, answer never in the DOM before submission, markdown safety, Cyrillic, Ask Claude message and the three
  deliveries. E2E: a session end to end, stop and resume after a reload, a 5-question timed mock, a mock that times
  out, feedback in the list, Ask Claude share and copy, Settings tests, flashcards, touch targets.

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
