# TheHub — Backlog

Where things stand and what is next. Newest state at the top; history is in `CHANGELOG.md`.

## 2026-11-15 overnight: committed on local `main`, NOT pushed (Martin reviews first)

Martin asked for as much progress as possible while he slept, questions collected for the morning, commits but no
push. Done (CHANGELOG 0.9.4–0.9.6): clearer study apps (ISTQB and Bulgarian: session first, icon tabs, mastery
bars), the Gym's other tabs and a Check-in bug fix, Bulgarian ready for the book (Lessons tab and session card
appear with the first chapter). The Fridge needed no change. **Next: Martin reviews, then push.** His open
questions from tonight: Q-4 (the book: does he have it, with CDs?), Q-25 (coach notes' calorie target), Q-26 (should
the Fridge grow?). Screenshot helpers for these passes are in the git-ignored `private/tools/`.

## 2026-11-14: the Gym's home plan and its additions (versions 0.8.2 and 0.8.3)

Martin trains at home now. The Gym has a **home plan** (Day A/B/C, bodyweight and dumbbells, a moving
figure for every exercise), a calf raise every day, loads as the kg to log, office days and ladder steps
(CHANGELOG, 2026-11-01 and 2026-11-14). Both branches are merged into local `main`; nothing is pushed.

- **Decided 2026-11-14: a fresh start.** Martin's gainz-tracker history is months old and the gains are gone, so
  the Fighter and streak start at zero with the home plan. **No import** and **no side-by-side week**: item 3 below
  shrinks to "export gainz-tracker's data once, as an archive in `private/` (never imported), then retire it".
- **Built 2026-11-14 (0.9.0): the Fighter as a story**, Season 1, 20 stages, real weather, plus a quote of the day.
  `src/modules/gym/story/season1.js` and `docs/fighter/` are SPOILERS: never show Martin a locked stage. Martin's
  first-run steps: Settings → Fighter weather → his town (he named it on 2026-11-14; not written here, the repo is
  public), and Gym → Protein → his weight (no default since 0.9.1). **All done 2026-11-15** (checked in the backup). Later seasons are new adventures (Martin: "seasons", "arcs"). The brief, kept for Season 2: detailed pixel art; a fantasy world of frog
  bounty hunters, where bounty hunting is the main income and hunters belong to classes with their own gear and
  abilities; the hero is a beginner who has chosen a class. Stage 1 introduces him, stage 2 shows his quest, the
  rest is the adventure; upgrades are gear as well as muscle; the order must surprise him, so **never show Martin
  the stages ahead of time**. More than 10 stages (gainz's 10 ran to 120 sessions). Stage 1 sample (hero Tad, a Bogbrawler who
  fights with his fists, in the marsh town of Lilyhollow): https://claude.ai/artifact/QEUbKDm5f5WRKpYbiG1eBc, source
  `docs/fighter/stage-1-sample.html` (canvas pixel art, 160 × 120). **Martin, 2026-11-14: "Art is perfect"; 20 stages make
  Season 1, and later seasons are new adventures (arcs).** Two open choices before the build: real-life weather in
  the scenes (proposal: Open-Meteo, free and keyless, with a town Martin sets, not GPS; cached for offline) and a
  small motivational quote (Martin is to pick the kind of quotes he likes from examples). Replacing the 10 STAGES breaks
  the "identical to gainz-tracker" Fighter test on purpose; with the fresh start no stored stage needs mapping.
- **Schema 3 and Q-8:** data saved by 0.8.1 or older migrates on first open, and under Q-8 that migration is
  blocked until backups are set up. Nothing was ever on the phone, so there the Gym starts fresh at version 3.
- **Notion (Martin asked, 2026-11-14):** TheHub does not use Notion. Its only link is the one-time ISTQB progress
  import (Part 6); gainz-tracker's Notion backups end when it retires. **Done on Claude's side, 2026-11-14:** Notion
  was checked (read-only): nothing newer than the October import; `private/istqb-progress.json` was rebuilt with today's
  code (old copy: `private/istqb-progress.2026-10-17.json`) and passes the app's import check (summary in `private/istqb-notes.md`). What is left is Martin's: Settings → Import ISTQB progress on the phone,
  after Part 1; then Notion is no longer needed.
- **Ideas, not planned:** change the usual office days in the app (now: per week only, default Tue/Thu); a
  plates picker instead of kg.

## Waiting on Martin, in priority order (2026-10-18, end of the autonomous build)

Part 7's book-free half was the last part that could be built without you. Everything below needs you; the first
item unblocks most of the rest.

1. ~~**Part 1: create the two GitHub repos and push `main`** (Q-3).~~ **Done 2026-11-14:** `MartinLNoel/TheHub`
   (public) and `MartinLNoel/thehub-backup` (private) exist; the first CI run failed on a flaky test (fixed, see
   CHANGELOG), the second passed and deployed 0.9.1 to https://martinlnoel.github.io/TheHub/. Next: install it on
   the phone (first-run steps in the 2026-11-14 section above), then item 2.
2. ~~**Backups for real** (Part 3): the fine-grained token, the first backup, the restore drill~~ **Done
   2026-11-15:** token set on the phone, manual backup, restore drill, safety backups before restore and import; the
   latest backup was checked by Claude (cloned into the git-ignored `private/thehub-backup/`): it passes the app's
   verification and holds no token. Still open: Q-8 and Q-9.
3. **Gym move** (Part 4), **shortened 2026-11-14 (fresh start)**: gainz-tracker's `export-button` branch and one
   export, kept as an archive in `private/` and not imported; then Q-11 and gainz-tracker's retirement. Q-2, Q-10
   and Q-12 are moot unless Martin changes his mind.
4. **ISTQB** (Part 6): ~~import `private/istqb-progress.json` on the phone~~ **imported 2026-11-15** (the backup
   after it matches the file exactly: sessions, answers, mastery, review queue, next lesson; Notion is no longer
   needed). Still open: Q-1, Q-15, Q-16, and studying in TheHub. The uploaded copy of the file is still in
   `thehub-backup` (Martin will delete it).
5. **Ask Claude on the phone** (Q-13: which delivery works) and the study defaults (Q-14).
6. **Fridge on the phone** (Part 8): the Diagnostics line and five real scans (Q-19, Q-20), then Q-21.
7. **Bulgarian** (Part 7): the Diagnostics voice line and a 🔊 try (Q-22), the trainer defaults (Q-23), then the
   **course book** (Q-4), which starts the book run.
8. When convenient: icon and colours (Q-5), the version scheme (Q-6), a custom domain for the token (Q-7).
9. Outside TheHub (not done: these builds may not touch other folders): the project hub has **no TheHub entry**
   yet, and its Bulgarian and MiniFridge entries should say they now live in TheHub
   (`C:\Users\marti\Documents\hub\update-project-entry.md`); MiniFridge's spec needs a "superseded" note.
   *Update 2026-10-18: the hub's TheHub, Bulgarian and MiniFridge entries are now up to date; only MiniFridge's own
   "superseded" note remains (Part 8 USER ACTIONS).*

## Where things stand (2026-10-18, after Part 7 before the book)

- **Part 1 (repos, Pages): not done.** It is manual and Martin's to do (Q-3). Nothing has been pushed anywhere.
- **Part 2 (core shell): built and merged into local `main`.** It was built **autonomously while Martin was away**:
  every placeholder is in `QUESTIONS.md`. All unit and e2e tests pass locally. The CI workflow is written and its
  shape is unit-tested, but it has **never run on GitHub** (no remote exists yet).
- **Part 3 (verified backup and restore): built and merged into local `main`** (version 0.3.0), also autonomously.
  All unit and e2e tests pass locally; GitHub is only ever mocked in them, so **no real backup has been made yet**.
  New placeholders: Q-7, Q-8, Q-9.
- **Part 4 (Gym): built and merged into local `main`** (version 0.4.0), also autonomously. All unit and e2e tests
  pass locally. The import was built against a **synthetic** gainz export: Martin's real export does not exist yet.
  gainz-tracker's export button is on its local branch `export-button` (c476b99), not merged or pushed. New
  placeholders: Q-10, Q-11, Q-12; Q-2 has what was found.
- **Part 5 (study engine): built and merged into local `main`** (version 0.5.0), also autonomously. All unit and
  e2e tests pass locally. The engine ships **no course**: the sample course lives in `tests/fixtures/` and only the
  test build shows it, so there is nothing to study on the phone until Part 6. **Ask Claude was not tested on the
  phone** (Q-13); Settings → Ask Claude has a test button for each delivery so Martin can try them without a
  course. Engine defaults: Q-14. API for module authors: `src/core/study/README.md`.
- **Part 6a (ISTQB module): built and merged into local `main`** (version 0.6.0), autonomously (paused once by
  Martin and resumed). All unit and e2e tests pass locally. Built: the module on `createStudyModule` (home with
  chapters X/6, readiness gate, next step; sessions; Chapter 3–6 mini-mocks; the 40-question full mock with the
  official weighting; wrong-answer review; flashcards; feedback; Today card; 10-day warm-up; the Study shortcut;
  Settings → **Import ISTQB progress**), the one-time Notion import (`scripts/istqb-import.mjs`), the content
  scaffolding (`content/istqb/`: manifest, the 64 objectives, one example lesson §3.1 with 9 questions, 22
  flashcards), `docs/istqb-content-guide.md` and `docs/content-loop.md`. Small engine additions (content manifest,
  `adjustSession`/`homeCards` hooks, step labels, `"__done__"` pointer resumes, imported-session objectives).
  Martin's progress is in **`private/istqb-progress.json`** (git-ignored, never committed); its
  summary is in `private/istqb-notes.md` (Q-1, Q-15). New placeholders: Q-15, Q-16.
- **Part 6 content run Ch3 + Ch6: done** (version 0.6.1, branch `content/istqb-ch3-ch6`, merged into local
  `main`, not pushed). Lessons §3.2, §6.1, §6.2 (§3.1 kept, one line added); 77 questions (Ch3 55, Ch6 22; 6–12 per
  LO, more for the shaky FL-3.2.3, 3.2.4, 6.1.1 and for 6.2.1); 25 new flashcards (47 in all). The ≥ 6 per objective
  check now runs for Chapters 3 and 6. Q-17 (lesson order) was narrowed by the Ch4 run, below.
- **Part 6 content run Ch4: done** (version 0.6.2, branch `content/istqb-ch4`, merged into local `main`, not
  pushed). Six lessons: §4.1, §4.2 split in two (`4.2a` EP and BVA, `4.2b` decision tables and state transitions),
  §4.3, §4.4, §4.5; 118 questions (6–12 per LO; 10–12 for each of the five K3 LOs; 8 for the extra-drilling
  experience-based LOs 4.4.1 and 4.4.2); 36 new flashcards (83 in all). Every K3 answer and worked example was
  checked with a throwaway script. The ≥ 6 per objective check now runs for Chapter 4, plus a ≥ 10 check for its
  K3 LOs and a course-order check. **Q-17 narrowed:** the lesson after §3.2 is now §4.1; the same gap now sits
  between §4.5 and §6.1 until the Ch5 run ships (see Q-17 before studying past §4.5).
- **Fix Q-18: done** (version 0.6.3, branch `fix/local-date`, merged into local `main`, not pushed). Study sessions
  and mocks are dated with the local day through the new `src/core/dates.js`; no migration (same shape, no old
  dates on the phone). The e2e "import progress, then a session" is pinned to Amsterdam at 00:20, so it no longer
  depends on the hour it runs. The Gym keeps UTC (Q-11, now with a note on how to switch).
- **Part 6 content run Ch5: done** (version 0.6.4, branch `content/istqb-ch5`, merged into local `main`, not
  pushed). Seven lessons (§5.1 split into `5.1a`, `5.1b`, `5.1c`; §5.2–5.5); 124 questions (6–8 per LO; 11 for
  5.1.4 and 5.1.5, 14 for 5.5.1 with extra severity-vs-priority drilling); 27 new flashcards (110 in all). Every
  calculation checked with a throwaway script. **Q-17 answered:** the course now runs §3.1 to §6.2 with no gap.
- **Part 6 content run Ch1–2 questions: done** (version 0.6.5, branch `content/istqb-ch1-ch2`, merged into local
  `main`, not pushed). Questions and flashcards only, no lessons: 181 questions (Ch1 109, Ch2 72; 6–10 per LO,
  8–10 for the Legacy extra-drilling LOs); 40 new flashcards (150 in all). The bank holds 500 questions.
- **Part 6 content is complete.** Every objective has at least 6 questions; full mocks have their 40 questions with
  the official weighting and count for the readiness gate; the 10-day warm-up and delayed retrieval now draw on
  Chapters 1–2. Further content changes come through the content loop (`docs/content-loop.md`) from Martin's
  feedback and wrong answers. **Part 6's USER ACTIONS below are still Martin's** (import on the phone, Q-1, Q-15,
  Q-16, first commute session).
- **Part 8 (Fridge): built and merged into local `main`** (version 0.8.0, branch `part-8/fridge`), autonomously.
  All unit and e2e tests pass locally and with `TZ=UTC`. Built: the Fridge module (items, places, expiry order,
  used / thrown-away counts, Today card for today + 2 days), scanning (`BarcodeDetector`, else the vendored
  barcode-detector 3.2.2 / zxing-wasm 3.1.3 fallback, offline-capable), Open Food Facts lookups with a cache and an
  offline queue, manual entry, and the core's **`hub.offer`** (Part 0). **Scanning and Open Food Facts were never
  tried for real:** no phone camera, and no test may call OFF (all mocked): Q-19, Q-20. The Bulgarian link is
  wired, and live since Part 7's book-free half (0.8.1) added `accept`. New placeholders: Q-19, Q-20, Q-21.
- **Part 7 before the book (Bulgarian): built and merged into local `main`** (version 0.8.1, branch
  `part-7/bulgarian-prebook`), autonomously. All unit and e2e tests pass locally and with `TZ=UTC`. Built: the
  module on the study engine (home with words learned, streak, cards due, alphabet progress and a "Lessons start
  when your course book is added" panel; Today card), the Cyrillic alphabet trainer (30 letters with sounds,
  approximations, examples and Russian-trap notes; letter → sound, sound → letter, reading practice on 42 everyday
  words), two-way cards, the **"From my home" deck** (`accept`: the Fridge's words now arrive, and the Fridge asks
  for the Bulgarian word after each item added), and the 🔊 button (`speechSynthesis`, only with a `bg-BG` voice)
  with a Diagnostics line. **Never tried on a phone, and no real voice was used** (mocked in tests): Q-22. New
  placeholders: Q-22, Q-23. The book run is described in `docs/bulgarian-content-guide.md`.
- Next: nothing more can be built without Martin (see "Waiting on Martin" above). Part 7 proper waits for the book
  (Q-4).

## Martin's USER ACTIONS still open for Part 7 (before the book)

(After Part 1 and the first push.)
1. Settings → **Diagnostics**: send Claude the "Speech voice bg-BG: …" line; if available, try a 🔊 (Q-22).
   Record it here: *bg-BG voice: not checked yet*.
2. Bulgarian → **Alphabet**: do a round of each practice; add one Fridge item and its Bulgarian word, and review
   its two cards. Answer Q-23.
3. Get the course book (Q-4) and put it in the private Bulgarian folder; then start the book run.

## Martin's USER ACTIONS still open for Part 8

(After Part 1 and the first push.)
1. Settings → **Diagnostics**: send Claude the "BarcodeDetector …" line (Q-19).
2. Fridge → **📷 Scan item**: allow the camera, scan five real products; check names, brands and the expiry dates
   you set; note which reader the scan screen says it used (Q-19, Q-20). Then answer Q-21.
3. MiniFridge: add a "superseded by TheHub" note to its spec and update its hub entry (not done: outside TheHub).

## Martin's USER ACTIONS still open for Part 6

(After Part 1 and the first push.)
1. Copy `private/istqb-progress.json` to the phone (email it to yourself, or put it in the private backup repo
   and download it), then **Settings → Import ISTQB progress** → pick the file → **Import**.
2. Check the ISTQB home shows the chapters done and the next session listed in the import summary.
3. Answer Q-1 (did a Session 10 happen on 12 October?), Q-15 and Q-16.
4. Do the next commute session in TheHub; use **Ask Claude** and **📝 Feedback**. Stop using the Claude Project
   for sessions (keep it as an archive).

## Martin's USER ACTIONS still open for Part 5

(After Part 1 and the first push.)
1. On the phone: **Settings → Ask Claude** → tap **Test: Share sheet**, **Test: Link (experimental)** and **Test:
   Copy and open Claude**; tell Claude which work (Q-13). Record the result here:
   - Share sheet: *not tested yet* · Link: *not tested yet* · Copy and open Claude: *not tested yet*
2. Leaving feedback and seeing it in the Feedback list can only be tried once a course ships (Part 6); the e2e tests
   cover it with the sample course.
3. Answer Q-14 (session sizes, re-teach rule, mastery rule).

## Martin's USER ACTIONS still open for Part 4

(After Part 1 and the first push.)
1. gainz-tracker: merge the local branch `export-button` into `main` and push (Q-2 says how it reaches the phone).
2. On the phone: export from gainz-tracker (Check-in → **⬇ Export all data (JSON)**), then in TheHub **Settings →
   Import from gainz-tracker** (or "Use the gainz-tracker data on this phone" if that button shows). Answer Q-10.
3. Compare side by side: same number of workouts, same fighter stage, same protein today.
4. Use TheHub for workouts for one week; keep gainz-tracker installed but stop logging there.
5. After that week, if nothing is missing: tell Claude to archive gainz-tracker (README note, archived repo, its
   `CLAUDE.md` pointing to TheHub, hub entry). **Not done: Martin's call.**

## Martin's USER ACTIONS still open for Part 3

(After Part 1 and the first push, see below.)
1. Create the fine-grained token (`docs/plans/part-3-backup.md`, "USER ACTIONS REQUIRED"): only `thehub-backup`,
   Contents read and write, 1 year.
2. On the phone: tap **Update available** if shown → **Settings → Backup** → paste the token, enter its expiry date
   → **Save** → **Test connection** → **Back up now**.
3. Check on GitHub that `thehub-backup` has a `backup.json` commit, and Today shows the green tick.
4. **Restore drill:** Settings → Backup → **Restore…** → pick that backup → restore. (Until a module ships, Part 4,
   there is no module data, so a backup reports "nothing to back up yet"; do steps 2–4 after Part 4 is live.)

## Martin's USER ACTIONS still open for Part 2

1. Do Part 1 (create `MartinLNoel/TheHub` public and `MartinLNoel/thehub-backup` private, Pages source "GitHub
   Actions"), then push `main`.
2. GitHub → **Actions** tab: wait for the green tick on the first run (the first real test of `ci.yml`), then open
   `https://martinlnoel.github.io/TheHub/`.
3. Install it on the phone: Chrome → menu (⋮) → **Add to home screen / Install app**.
4. Check: it opens full-screen from the icon; long-press shows the three shortcuts (they show "coming soon" until
   their modules arrive); aeroplane mode, then reopen: it still works.

## Next steps

- [ ] Part 1 (Martin, manual) — Q-3
- [x] Part 3: verified backup and restore (code done; Martin's token, first real backup and restore drill open)
- [x] Part 4: Gym (code done; Martin's export, import, side-by-side week and gainz-tracker's retirement open)
- [x] Part 5: study engine (code done; Ask Claude on the phone open, Q-13)
- [x] Part 6a: ISTQB module, progress import, scaffolding, content loop (Martin's import on the phone open)
- [x] Part 6 content runs: [x] Ch3 · [x] Ch6 · [x] Ch4 · [x] Ch5 · [x] Ch1–2 questions (Martin's USER ACTIONS open)
- [x] Part 8: Fridge (code done; scanning on the phone, Q-19 to Q-21 and the MiniFridge note open)
- [x] Part 7 before the book: module, alphabet trainer, reading practice, "From my home" deck, 🔊 (Q-22, Q-23 open)
- [ ] Part 7 book run: lessons, vocabulary and quizzes per chapter (gated on the book, Q-4)

## Known gaps and notes

- The first push will be the first time CI runs; watch it. If the version check misbehaves on the very first push
  (no previous commit on GitHub), it falls back to checking only that `sw.js` and `src/version.js` agree.
- Placeholder icons (Q-5) and the version scheme (Q-6) wait for Martin's answers.
- Backups have never talked to the real GitHub API: the client follows GitHub's documented contents/commits
  endpoints and CORS, but only the phone run (USER ACTIONS above) proves it. Watch for: the 401/403/404 texts,
  the read-back at the new commit, and `redirect: 'manual'` (a renamed repo is reported, not followed).
- Part 4 ships the first module (Gym), so backups now have data; Part 3's restore drill can be done once the Gym
  has some.
- The gainz import was tested only with a synthetic file of the same shape; the first real import is the real test
  (watch the preview counts against gainz-tracker).
- Migrations are blocked while backups are not set up (Q-8).
- Fridge: the fallback scanner adds about 1.1 MB (`zxing_reader.wasm`) to the first-install download (it is in
  `PRECACHE` so scanning works offline); it is loaded into memory only when the phone has no usable
  `BarcodeDetector`. To update it, follow `src/vendor/barcode-detector/README.md`.
- Calendar dates: the study engine, ISTQB, Bulgarian and the Fridge use the local day (`src/core/dates.js`, Q-18 fixed in 0.6.3); the Gym
  still uses the UTC day on purpose until Q-11 is answered.
- Study engine: the Today card learns the next lesson's title only once the course has loaded (the first Today
  render after opening may lack that line). Course content is fetched from `content/<course>/` (network first,
  cache fallback); Part 6 must add its content files to `PRECACHE` (the shell test now requires it) so the course
  works offline from the first visit.
- Part 5 core changes other parts rely on: parameter routes (`'lesson/*'`, `src/core/router.js` `resolveRoute`),
  and `settings` + `params` in every module screen's context (Part 0, module contract).
