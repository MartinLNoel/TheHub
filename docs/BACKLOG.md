# TheHub — Backlog

Where things stand and what is next. Newest state at the top; history is in `CHANGELOG.md`.

## Where things stand (2026-10-17, after Part 3)

- **Part 1 (repos, Pages): not done.** It is manual and Martin's to do (Q-3). Nothing has been pushed anywhere.
- **Part 2 (core shell): built and merged into local `main`.** It was built **autonomously while Martin was away**:
  every placeholder is in `QUESTIONS.md`. All unit and e2e tests pass locally. The CI workflow is written and its
  shape is unit-tested, but it has **never run on GitHub** (no remote exists yet).
- **Part 3 (verified backup and restore): built and merged into local `main`** (version 0.3.0), also autonomously.
  All unit and e2e tests pass locally; GitHub is only ever mocked in them, so **no real backup has been made yet**.
  New placeholders: Q-7, Q-8, Q-9.
- Next: **Part 4 (Gym)**, branch `part-4/gym`.

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
- [ ] Part 4: Gym · Part 5: study engine · Part 6: ISTQB · Part 7: Bulgarian (gated) · Part 8: Fridge

## Known gaps and notes

- The first push will be the first time CI runs; watch it. If the version check misbehaves on the very first push
  (no previous commit on GitHub), it falls back to checking only that `sw.js` and `src/version.js` agree.
- Placeholder icons (Q-5) and the version scheme (Q-6) wait for Martin's answers.
- Backups have never talked to the real GitHub API: the client follows GitHub's documented contents/commits
  endpoints and CORS, but only the phone run (USER ACTIONS above) proves it. Watch for: the 401/403/404 texts,
  the read-back at the new commit, and `redirect: 'manual'` (a renamed repo is reported, not followed).
- With no module shipped, the shipped build has nothing to back up; the Backups card stays at "No verified backup
  yet" until Part 4.
- Migrations are blocked while backups are not set up (Q-8).
