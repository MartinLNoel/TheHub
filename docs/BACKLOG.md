# TheHub — Backlog

Where things stand and what is next. Newest state at the top; history is in `CHANGELOG.md`.

## Where things stand (2026-10-18, after the Ch4 content run)

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
- **Next: the remaining Part 6 content runs**, one session each, with the prompt in `docs/content-loop.md`:
  1. **Ch5**: lessons 5.1–5.5 + questions (≥ 8 for 5.1.4, 5.1.5, 5.5.1). Ship it before Martin reaches §4.5.
  2. **Ch1–2 questions only** (no lessons), for full mocks and warm-ups.
  Until both are done, full mocks are short and do not count for the readiness gate; Martin can study §3.1 to
  §4.5 now.
- Next after Part 6: Part 8 (Fridge), then the book-free parts of Part 7.

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
- [ ] Part 6 content runs: [x] Ch3 · [x] Ch6 · [x] Ch4 · [ ] Ch5 · [ ] Ch1–2 questions
- [ ] Part 7: Bulgarian (gated) · Part 8: Fridge

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
- Study sessions are dated in UTC but compared with the local date (Q-18): the e2e test "import progress, then a
  session" fails between local midnight and 02:00 CEST. Fix in the next code session.
- Study engine: the Today card learns the next lesson's title only once the course has loaded (the first Today
  render after opening may lack that line). Course content is fetched from `content/<course>/` (network first,
  cache fallback); Part 6 must add its content files to `PRECACHE` (the shell test now requires it) so the course
  works offline from the first visit.
- Part 5 core changes other parts rely on: parameter routes (`'lesson/*'`, `src/core/router.js` `resolveRoute`),
  and `settings` + `params` in every module screen's context (Part 0, module contract).
