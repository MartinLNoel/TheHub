# TheHub — Changelog

Dated entries, newest first.

## 2026-11-14 — The first push to GitHub; a flaky test fixed (no app change)

- **First CI run on GitHub: the browser test "Settings → Ask Claude: choose the delivery" failed** (twice, with the
  retry), while it passes on Martin's PC. Cause, in the test: it chose "Link" and reloaded at once; the app saves
  first and only then marks the button, so on GitHub's slower runner the reload came before the save. Reproduced on
  the PC by slowing the storage write (an init script that runs 400 reads before the write): the old test fails
  with GitHub's exact error, the fixed one passes three times out of three. Fix: wait for the button to show the
  choice before reloading. The other tests that reload already wait for a sign of the save.
- CI now also reports failed browser tests as annotations on the run (`playwright.config.js`, "github" reporter):
  the job logs need a login, the annotations do not.

## 2026-11-14 — No default body weight; personal details out of the public repo (version 0.9.1)

- **No default body weight** (Gym schema 5, migration 4 → 5 keeps a stored weight): Martin's weight changes, so a
  fresh Gym has none. Until he enters it (Protein tab, now at the top while it is missing, or a weekly check-in), the
  app asks for it instead of showing a protein target; an empty or nonsense entry keeps the weight there was.
- **Before the first push, the whole history was cleaned** (all branches, files and commit messages, with
  `git filter-branch`): personal details earlier sessions had written into docs and comments were removed or made
  neutral (study results, routine and life details, Notion links, a wrong claim about push-ups). The details that matter for the study system moved to the git-ignored
  `private/istqb-notes.md`; a backup of the history before the cleanup is in `private/` (git-ignored). Rule kept in
  `CLAUDE.md`: never commit personal data; the repo is public.

## 2026-11-14 — The story Fighter, real weather, a quote of the day (version 0.9.0)

Branch `gym/story-fighter`. No plot here on purpose: Martin wants the story to surprise him.

- **core: `settingsCard`** (module contract): a module may add a card to Settings; `save(next)` runs the module's
  `validate`, saves and updates the app's copy, refuses read-only data; a card that throws shows as a warning.
- **Quote of the day** on the Gym's Today card (`quotes.js`): 23 quotes in the five kinds Martin picked (calm
  discipline, fighters, sayings from the story's world, dry humour, small steps), the same all day.
- **The Fighter is Season 1 of a story** (`src/modules/gym/story/`, SPOILERS): 20 stages from 0 to 140 sessions
  replace gainz-tracker's 10. Each stage is a 160 × 120 pixel-art scene drawn in code (pixel engine, characters,
  places, `season1.js` with the chapters, a renderer with animated weather), shown with its chapter only once
  unlocked; locked stages show neither picture nor name. The hero's gear and muscle grow with the story. The old SVG
  fighter (`fighter.js`) is gone; the gainz parity tests no longer cover stages, and the gainz import preview no
  longer names a stage.
- **Real weather** (`story/weather.js`, `weather-settings.js`): Settings → Fighter weather finds a town by name
  (Open-Meteo, free, no key); outdoor scenes then show its rain, drizzle, snow, fog, thunder and day, dusk or night
  (indoor scenes through the window). Only the town's position (rounded to about 1 km) is sent; the last reading is
  cached on the phone for 30 minutes and used offline. **Gym schema 4**: `weatherTown` (migration 3 → 4: none).
- Tests: `module-settings`, `gym-quotes`, `gym-fighter` (every stage drawn in four weathers, no gaps), e2e for the
  scene (every pixel painted, the rain moves, locked stages hidden), the town search (fake Open-Meteo) and the quote.
  570 unit and 56 e2e tests pass locally. Every commit on the branch passes the unit tests on its own.
- The ISTQB Notion transfer file was rebuilt (`private/istqb-progress.json`, git-ignored): Notion has nothing newer (checked 2026-11-14, read-only), and the file passes the app's import check.

## 2026-11-14 — Gym: Martin's review of the additions (version 0.8.4)

Branch `gym/feedback-2026-11-14`.

- **Office days no longer say "rest"** (Today card and the week card): Martin trains on an office day when the week
  needs it. They still count as busy days for the "free days left" warning.
- **Every ladder starts at its bottom step.** Correction: Martin did not say push-ups were too easy; the regular
  push-up is where he wants to start. The incline push-up is gone (the push-up ladder has 5 steps), and the pike and
  dip ladders start at step 1 too.

## 2026-11-14 — Gym: the home plan's additions (version 0.8.3)

From Martin's review of the home plan. Branch `gym/home-plan-additions`, one commit per feature.

- **Calf raise every day**: single-leg calf raise on the yoga block, by a wall, 3×15–20 per leg, in each day's
  main block (now 7). Martin's goal now includes legs in proportion and a tight stomach; a test checks that every
  day trains two leg moves, calves, core and lower abs.
- **Loads as the kg to log** (Q-24 answered): Martin logs the plates on one dumbbell and ignores the handle. Each
  load reads e.g. "5 kg · both DBs, 2.5 each side"; the day card says kg = plates on one dumbbell, bodyweight = 0,
  holds = seconds in "reps".
- **Office days** (Gym schema 3, migration 2 → 3): `officeDays` (usual, default Tuesday and Thursday) and
  `officeWeeks` (a week's own list). A "This week" card on the Workout screen: a button per day to mark or unmark
  an office day for this week, sessions and free days left, and a warning when the free days left are no more than
  the sessions left. The Today card adds an office-day line and that warning. Nothing is blocked: any day can be
  trained, weekends included (Martin's choice, 3 days in a row included).
- **Ladder steps**: push-ups, pike push-ups
  and chair dips record their step (`exercises[].step`, optional, validated); − and + on the Workout screen; a
  nudge to move up after a session at the top of the range on every set; personal bests per step.
- Tests: `gym-office-days.test.js`, `gym-ladders.test.js`, plus updates; 526 unit and 53 e2e tests pass locally.

## 2026-11-01 — Gym: the home plan with moving demonstrations (version 0.8.2)

Martin trains at home now; with Claude he worked out a home plan (bodyweight plus his dumbbells, no
jumping, no bands or towels) and asked for the plan page's moving figures in the app. Branch `gym/home-plan`.
The plan page: https://claude.ai/artifact/BLU6hUP38wvW7JVsByjYY3.

- **Program switch** on the Workout screen: 🏋️ GYM PROGRAM (gainz-tracker's, unchanged) or 🏠 HOME PLAN. Saved, so it
  survives a reload; switching keeps the history, streak, Fighter stages and the gym phase.
- **The home plan** (`HOME_PROGRAM`, `HOME_PLAN` in `program.js`): full body 3×/week, Day A (push emphasis), Day B
  (shoulders + width), Day C (dips + back); each a main block of 6 and an arm + shoulder add-on of 3, with the
  starting dumbbell load as plates per side. Same rules as the gym program: Monday restarts at Day A, 3 sessions
  for the week and the streak, no Phase 2 prompt, no GYM/HOME version toggle; sessions are logged as `mode: 'home'`.
- **Moving demonstrations** (`demos.js`): a stick figure per exercise moving between the start and end of the rep
  over a faint outline of the end, dumbbells and chair drawn in, HOLD on holds; theme colours; one animation loop
  for the figures on screen; still with reduced motion. Each comes with a form cue and a "Watch a demo ↗" YouTube
  search link.
- **Gym schema version 2**: adds `program` (`'gym' | 'home'`); migration 1 → 2 sets `'gym'`. The gainz import maps
  to `'gym'` and a merge keeps the current choice. Defaults to confirm: Q-24.
- Tests: `tests/unit/gym-home-plan.test.js`, `gym-demos.test.js` and `gym-home-plan-screens.test.js` (50), and two e2e tests (switch, figures move, log Day A, reload; phone
  width and 48 px targets). 501 unit and 53 e2e tests pass locally.

## 2026-10-18 — Part 7 before the book: the Bulgarian module (version 0.8.1)

Built autonomously while Martin was away, on branch `part-7/bulgarian-prebook`, merged into local `main` (not
pushed). Only what does not depend on the course book (Q-4); nothing pretends to follow it. Plan:
`docs/plans/part-7-bulgarian.md` ("Built before the book").

- **Version 0.8.1, not 0.7.0.** 0.7.0 was kept for Part 7, but the Fridge shipped as 0.8.0 first; going back to
  0.7.x would look like a downgrade, and the service worker's cache name (`thehub-<version>`) must change with
  every update, so the phone sees it. 0.8.1 does both (Q-6).
- **Module** `src/modules/bulgarian/` (nav tab 🇧🇬 Bulgarian, between ISTQB and Fridge), made with
  `createStudyModule`: its own home (words learned, streak, cards due, alphabet progress, the "From my home" deck
  with 🔊 and Remove, and a **"Lessons start when your course book is added"** panel instead of lessons), sub-tabs
  Home · Alphabet · Cards · Feedback, the engine's two-way cards (each direction scheduled separately), Ask Claude
  and Feedback. Today card: cards due, alphabet progress, streak; one tap to review cards or practise letters.
  Schema version 1 (study progress plus `alphabet`, `reading`, `activity`, `homeDeck`; Part 0).
- **Cyrillic alphabet trainer** (`#/bulgarian/alphabet`): all 30 letters, upper and lower case, each with its sound,
  an English approximation and an example word, in our own words; notes where Bulgarian differs from Russian (Е is
  never "ye", unstressed О stays "o", Щ is "sht", Ъ is a vowel, Ь only before О; no Ё, Ы, Э). Practice rounds of
  10 (`#/bulgarian/practice/to-sound | to-letter | reading`): letter → sound, sound → letter, and reading practice
  on 42 short everyday words (greetings, courtesy, numbers 1–10, food and drink, people, places), with
  similar-length distractors. Every answer is saved at once; a letter is "learned" after 2 right in a row both
  ways (Q-23).
- **"From my home" deck**: the module's `accept(item, data)` turns the Fridge's
  `hub.offer('bulgarian', { bg, en, topic })` into a two-way bg ↔ en card (`home-<n>`), and returns `null` for a
  word already there (case, spacing and Unicode form ignored), already a course card, or without Cyrillic or an
  English side. The Fridge's "Learn its Bulgarian name" prompt is therefore live.
- **Pronunciation**: `src/core/speech.js` (new): a 🔊 button through the browser's `speechSynthesis`, on the
  Bulgarian side of cards, letters' example words and reading words, shown **only when a `bg-BG` voice exists at
  runtime** (re-checked when Chrome's voice list arrives late), never with another language's voice. Settings →
  **Diagnostics** gains "Speech voice bg-BG: available / not available" (Q-22).
- **Content** `content/bulgarian/`: `index.json` (manifest ready for book chapters: empty `chapters`, `lessons`,
  `questions`, `cards`; names the trainer files), `alphabet.json`, `reading.json`, `handled-feedback.json`, all in
  `PRECACHE`. `docs/bulgarian-content-guide.md` (new) holds the rules and the book run; `docs/content-loop.md`
  covers the Bulgarian course.
- **Engine (small, optional hooks, documented in `src/core/study/README.md`):** `tabs` (a course's own sub-tabs),
  `cardExtras` (a node under a flashcard face), `onCardGraded` (change the saved data after a grade: the
  streak), `feedbackTitle` (Feedback list titles for module targets); `tabs`, `store`, `feedbackBox`, `askButtons`
  exported for module screens. ISTQB and the sample course are unchanged (default tabs tested).
- **Tests:** unit `tests/unit/bulgarian.test.js` (the 30 letters by code point and in order, Latin look-alikes
  rejected, every Latin form equal to what its letters spell, unique sounds, Russian-trap notes, numbers 1–10,
  manifest and `PRECACHE`; Cyrillic rendered unchanged, through export → import (same checksum, byte-identical),
  a tampered letter failing the checksum, and the GitHub backup's base64 upload and read-back; two-way cards
  scheduled per direction; `accept` adding and declining duplicates, also through `hub.offer`; the 🔊 hidden without
  a `bg-BG` voice and shown with a mocked one, also on the cards screen; streak, rounds, Today card, Diagnostics
  line), and engine hook tests in `study-screens.test.js`. E2E `tests/e2e/bulgarian.spec.js`: an alphabet round
  (one mistake, 9/10, saved, streak on Today), the Fridge → Bulgarian flow with the duplicate declined, a two-way
  card session with the mocked voice, Diagnostics with and without a voice, phone width and 48 px targets. The
  Fridge e2e tests now tap "Not now" on the Bulgarian prompt that appears after adding an item.
- New questions: Q-22 (a Bulgarian voice on the phone), Q-23 (trainer defaults). Q-4 and Q-6 have notes.

## 2026-10-18 — Part 8: the Fridge module (version 0.8.0)

Built autonomously while Martin was away, on branch `part-8/fridge`, merged into local `main` (not pushed). Version
0.8.0 (0.7 is left for Part 7, which waits for the book; Q-6). Plan: `docs/plans/part-8-fridge.md`; the superseded
MiniFridge plan gave the feature list and the Open Food Facts notes (its folder was not touched).

- **Module** `src/modules/fridge/` (nav tab 🧊 Fridge): items with name, brand, place (fridge / freezer / pantry),
  quantity, expiry date and added date, both local calendar dates through `src/core/dates.js`; lists sorted by
  expiry (no date last) with a place filter; expired items outlined red, today to +2 days amber; an item screen to
  edit it or mark it **used** or **thrown away** (the waste count; "added by mistake" counts neither). Text only:
  no photos. Schema version 1, `validate` used by backups.
- **Scan** (`#/fridge/scan`, the "Scan item" shortcut, so it no longer shows "coming soon"): the camera is asked for
  only when this screen opens; a refusal gets a clear message, and typing the barcode or adding by hand always
  works. Reader: the phone's `BarcodeDetector` when it reads EAN-13; otherwise the vendored **barcode-detector
  3.2.2** ponyfill with **zxing-wasm 3.1.3** (MIT; the zxing-cpp code in the `.wasm` is Apache 2.0), copied
  unchanged into `src/vendor/barcode-detector/` with its licences and SHA-256 sums, loaded on demand, its `.wasm`
  pointed at the local copy and listed in `PRECACHE`, so it works offline. EAN-13, EAN-8, UPC-A and UPC-E (stored
  as UPC-A), check digits verified.
- **Open Food Facts** (`off.js`): `GET /api/v2/product/<code>` with only the needed fields and
  `app_name=TheHub&app_version=…` (a browser cannot set `User-Agent`; Q-20); found → name and brand prefilled (and
  cached by barcode, so a rescan works offline); not found → Martin types the name; error or offline → the item is
  saved with its barcode (a stand-in name if none was typed) and **queued**; the Fridge home looks queued codes up
  when online (or "Look up now") and fills in stand-in names and empty brands. The attribution is shown.
- **Today card:** what expires today or in the next 2 days, plus anything already expired (up to 4 lines), and the
  number of scans still to look up; "Open Fridge" or "Scan item".
- **Core: `hub.offer`** (`src/core/hub.js`, new): `hub.offer(target, item)` and `hub.accepts(target)`, passed to
  every screen as `hub`; a module may declare `accept(item, data)` (registry-checked). Ignored when no module
  accepts, which is the case until Part 7: the Fridge then shows no Bulgarian prompt. When one accepts, after adding
  an item the Fridge asks for the Bulgarian word (prefilled from OFF's Bulgarian name) and offers
  `{ bg, en, topic: 'food' }`. Documented in Part 0.
- **Core: Settings → Diagnostics** (`src/core/diagnostics.js`): the phone's `BarcodeDetector.getSupportedFormats()`
  and camera availability, for Q-19.
- `src/core/dates.js` gains `isCalendarDate`. `scripts/serve.mjs` serves `.wasm` as `application/wasm`.
  `.gitattributes` keeps `src/vendor/` byte-for-byte.
- **Tests:** unit `tests/unit/fridge.test.js` and `fridge-screens.test.js` (barcodes; expiry sorting and the 2-day
  window, also at 00:30 local; Open Food Facts found / not found / error / timeout / offline with a mocked `fetch`;
  the offline queue resolved later; Today card; `validate`; `hub.offer` in the core and called by the Fridge with
  the right item; the scanner loop with a faked camera and detector; camera refusal; diagnostics) and a check of
  the vendored files' SHA-256. E2E `tests/e2e/fridge.spec.js`: manual entry at 00:30 Amsterdam time showing on
  Today; a scan with a faked camera and `BarcodeDetector` (OFF mocked, camera released, cached rescan); the **real
  vendored zxing reader decoding an EAN-13 drawn into a fake camera stream**, then the offline queue resolved; a
  refused camera; touch targets; the scanner working offline from the service-worker cache. No test reaches Open
  Food Facts (every OFF request is mocked or blocked). Unit and e2e suites pass in local time and with `TZ=UTC`.
- New questions: Q-19 (test scanning on the phone), Q-20 (OFF identification and limits), Q-21 (Fridge defaults).

## 2026-10-18 — Part 6 content run: Chapter 1–2 questions (version 0.6.5)

Written autonomously while Martin was away, on branch `content/istqb-ch1-ch2`, merged into local `main` (not
pushed). **Questions and flashcards only, no lessons** (Martin studied Chapters 1–2 before TheHub). All content in
our own words; no official sample-exam questions; distractors aimed at the Legacy Analysis traps (informal
paraphrase next to the exact term, adjacent-concept swaps, wrong actor, overgeneralisation).

- **Questions:** 181 (Ch1 109, Ch2 72), 6 to 10 per objective. 10 each for FL-1.2.3 (error, defect, failure,
  root cause), FL-1.4.3 (testware by activity) and FL-2.2.1 (test levels, acceptance vs system actors, alpha vs
  beta); 9 for FL-1.4.1 (Design vs Implementation), FL-1.4.4 (traceability, impact analysis) and FL-2.2.2
  (functional WHAT vs non-functional HOW WELL); 8 for FL-1.3.1, FL-1.5.1 (confirmation bias), FL-1.5.2 (XP) and
  FL-1.5.3; 7 for the objectives last rated "solid" (FL-1.4.2, FL-2.1.1, FL-2.1.3–2.1.6) and for FL-1.2.2 and
  FL-1.4.5. Correct answers spread A 46 · B 45 · C 45 · D 45. Every question was re-read cold for exactly one
  defensible answer, and the options were rebalanced so the key is no longer the longest option by habit (now
  the longest in about 1 question in 7). The bank now holds 500 questions.
- **Flashcards:** 40 new (150 in all): defect, failure, debugging; each of the seven principles from a scenario;
  testware per activity (planning, monitoring and control, analysis, design, implementation); analysis vs design;
  the two roles; whole team; TDD, ATDD vs BDD; DevOps; shift-left; the integration levels; alpha vs beta;
  confirmation vs regression; retirement; and list cards for test objectives, context factors, generic skills,
  independence (levels and drawbacks), SDLC effects and good practices, DevOps, shift-left, retrospective
  benefits, test levels, acceptance forms, test types and maintenance triggers.
- **Full mocks are now complete:** 40 questions with the official weighting (8 · 6 · 4 · 11 · 9 · 2), so they
  count for the readiness gate. **The 10-day warm-up and delayed retrieval now draw on Chapters 1–2** (Part 6a's
  warm-up was a no-op before, with no questions on the only studied objectives), and the wrong-answer retry now
  finds a bank question for imported Chapter 1–2 wrong answers.
- **Tests:** the ≥ 6 per objective check runs for all six chapters; the skipped whole-bank test was removed (no
  skipped test is left); new checks: ≥ 8 for the Ch1–2 extra-drilling objectives, unique ids and an even A–D
  spread, a full mock assembled from the shipped bank (three seeds: 40 different questions, official weighting,
  no shortfall), a second full mock with 40 fresh questions, the warm-up after the import drawing 5 Chapter 1
  questions, and delayed retrieval reaching the imported Chapter 1 lessons. The retry test now expects those
  Chapter 1 questions. E2E: the import-then-session run now walks the 5 warm-up questions, the quiz and 2 delayed
  retrieval questions (7/7); the mock run expects full-size mocks, and one full mock at 100 % shows
  "Approaching (recent: 100 %)". Unit and e2e suites pass in local time and with `TZ=UTC`.

## 2026-10-18 — Part 6 content run: Chapter 5 (version 0.6.4)

Written autonomously while Martin was away, on branch `content/istqb-ch5`, merged into local `main` (not pushed).
All content in our own words; no official sample-exam questions.

- **Lessons (7):** §5.1 split in three: `5.1a` (test plan, release and iteration planning, entry and exit
  criteria, Definition of Ready/Done), `5.1b` (the four estimation techniques with the three-point formula,
  the three prioritisation strategies, dependencies and resources, worked orders), `5.1c` (test pyramid, testing
  quadrants with a placement method; the quadrants got the extra explanation the Legacy Analysis asked for); §5.2
  (risk level, project vs product risks, product risk analysis, risk control and the four responses); §5.3
  (monitoring, control directives, completion, metric groups, progress vs completion reports, ways to
  communicate); §5.4 (configuration management, baselines); §5.5 (defect management, report content, a
  severity-vs-priority section with a 2 × 2 table and exam traps, and how to judge a report).
- **Questions:** 124 for Chapter 5 (6 to 8 per objective; 11 each for the K3 objectives 5.1.4 and 5.1.5, 14 for
  5.5.1, six of them on severity vs priority). Correct answers spread A 31 · B 31 · C 31 · D 31. Every
  estimate, ratio, extrapolation, risk level and prioritisation order (also the lesson examples) was recomputed
  with a throwaway script (not committed), which also checked that no distractor is another valid answer and
  that additional-coverage questions have no ties. Dependency questions state their rule ("highest priority as
  early as possible; dependencies right before it"), because "the highest-priority ready test first" gives a
  different order. Questions whose scenario repeated a lesson example were rewritten (SR-1).
- **Flashcards:** 27 new (110 in all): plan, planning horizons, entry/exit, estimation techniques, prioritisation,
  pyramid, quadrants, risk terms and responses, metrics, reports, baseline, defect report content and status.
- **Tests:** the ≥ 6 per objective check now runs for Chapter 5 too; the ≥ 10 K3 check covers Chapters 4 and 5;
  the course-order test now pins the full lesson order and §4.5 → §5.1a → … → §5.5 → §6.1.
- **Q-17 answered:** no lesson gap remains.

## 2026-10-18 — Fix Q-18: study sessions dated with the local day (version 0.6.3)

Fixed autonomously while Martin was away, on branch `fix/local-date`, merged into local `main` (not pushed).

- **Bug:** lesson sessions (`finishSession`) and mocks (`finishMock`) saved their `date` as the UTC day
  (`toISOString().slice(0, 10)`), while the ISTQB home and Today card compare it with the local day. Between local
  midnight and 01:00 (02:00 in summer) a session just done showed "Last session: 1 day ago" and the 10-day
  warm-up count could be a day off.
- **Tests first:** `tests/unit/local-date.test.js` (session and mock finished at 00:30 Amsterdam time = 22:30 UTC
  the day before; both failed on the old code with `'2026-10-17'` instead of `'2026-10-18'`), and the e2e test
  "import progress, then a session" now runs with the browser pinned to `Europe/Amsterdam` and a fixed clock at
  00:20 local (it failed on the old code with "Last session: 1 day ago."), so it no longer depends on the hour the
  suite runs.
- **Fix:** one shared helper, `src/core/dates.js` (`localDate`, `addDays`, `daysBetween`). Used by
  `session.js`, `mock.js`, `scheduler.js` (re-exports it; the SM-2 card dates were already local),
  `transfer.js` (export file name, already local), and the ISTQB `rules.js` (`daysSinceLastSession`; the
  module's own `localISO` copy is gone). Timestamps (`at`, `startedAt`, backups) stay ISO instants. The **Gym is
  unchanged** on purpose: it keeps gainz-tracker's UTC "today" until Martin answers Q-11.
- **No migration:** no stored value changes shape. `sessions[].date` was and stays a `YYYY-MM-DD` string; only
  the day chosen for a session finished just after local midnight changes, and only for new sessions. Old values
  cannot be told apart (a session has no stored time of day) and none exist yet: the app has never been
  deployed, so every session date on the phone will be written by the fixed code; the imported Notion sessions
  carry their own calendar dates. So the schema version stays 1.
- Unit and e2e suites pass in local time and with `TZ=UTC`.

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
