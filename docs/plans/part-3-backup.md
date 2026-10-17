# TheHub — Part 3: Verified Backup and Restore

**Depends on:** Part 2
**Branch:** `part-3/backup`
**Estimated effort:** 1–2 sessions

This part handles a secret (the GitHub token), so it is a part of its own.

---

## USER ACTIONS REQUIRED

### Create the backup token (fine-grained, one repo only)

1. GitHub → your avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**.
2. **Name:** `TheHub phone backup`. **Expiration:** 1 year (put a reminder in your calendar; the app will also warn).
3. **Repository access:** **Only select repositories** → `thehub-backup`. Nothing else.
4. **Permissions → Repository permissions → Contents: Read and write.** Leave everything else at "No access".
5. Generate, and **copy the token** (it starts with `github_pat_`). Do not paste it into any file or chat. You will
   type it into the app on your phone after this part is deployed.

---

## Instructions for Claude

> **IMPORTANT:** Start Claude Code from the project directory:
> `C:\Users\marti\Documents\Education\TheHub`
>
> Copy everything below this box and paste it as your prompt to Claude.

---

### Prompt Start

You are building **TheHub** (read `CLAUDE.md`, `SPEC.md`, `docs/plans/part-0-overview.md`, then `docs/BACKLOG.md`).
This is **Part 3: verified backup and restore** to the private repo `MartinLNoel/thehub-backup`, using a
fine-grained token that Martin enters on the phone. Create branch `part-3/backup` from `main`.

**Build:**

1. `src/core/github.js`: the GitHub REST calls needed, nothing more: read `backup.json` (latest, and at a given
   commit), list its commits (`GET /repos/{owner}/{repo}/commits?path=backup.json`), write it
   (`PUT /repos/{owner}/{repo}/contents/backup.json` with the current `sha`). Clear error messages for 401 (token bad
   or expired), 403/404 (no access to the repo), offline, and a `sha` conflict (re-read and retry once).
2. `src/core/backup.js`: build the backup (Part 0 format), **verify** it (checksum, migrations on a copy, every
   module's `validate`, item counts equal to live data), upload, then read it back from GitHub and verify the
   downloaded copy too. Only after the read-back passes, record `lastVerifiedBackup` in the core store.
3. **When it runs:** on app start and on `visibilitychange` to visible, if the last verified backup is older than
   24 hours; before every migration (connect Part 2's `beforeMigrate` hook; if the backup fails, do not migrate, and
   tell Martin); and from a "Back up now" button. Never more than once per 10 minutes automatically.
4. **Restore** (`#/settings/restore`): list past backups (commit date and message), preview what a chosen one
   contains (per module counts), verify it, and on confirmation take a fresh backup of the current state first, then
   replace. Restore runs migrations on old backups.
5. **Settings → Backup:** enter or replace the token (stored only in IndexedDB, shown masked, never logged, never
   exported, **excluded from backups and export files**), the token's expiry date (Martin types it once), a "Test
   connection" button.
6. **Today card "Backups":** "Last verified backup: <relative time> ✓"; amber after 30 hours; red after 48 hours or
   on the last failure, with the reason and a "Back up now" button; a warning 14 days before the token expires; a
   monthly "Export a copy to your phone" reminder that links to export.

**Tests (required):** mock `fetch` for GitHub. Unit: verify rejects a wrong checksum, a module failing `validate`,
and a count mismatch; a failed upload or failed read-back does **not** update `lastVerifiedBackup`; the token never
appears in a backup or export; migration is blocked when the pre-migration backup fails; the 24-hour and 10-minute
rules; restore takes a safety backup first; `sha` conflict retry. E2E: the Backups card's states (never, ok, amber,
red); restore flow with a mocked history.

Security review before finishing: read every place the token is read or sent, and confirm it only goes to
`api.github.com` in an `Authorization` header.

Update `docs/BACKLOG.md` and `docs/CHANGELOG.md`, bump the version, commit, push the branch.

### Prompt End

---

## USER ACTIONS after Claude finishes

1. Merge to `main` and wait for the green deploy.
2. On the phone, open TheHub → tap **Update available** if shown → **Settings → Backup** → paste the token, enter its
   expiry date → **Test connection** → **Back up now**.
3. Check on GitHub that `thehub-backup` now has a `backup.json` commit, and that Today shows a green backup tick.
4. **Do one restore drill:** Settings → Restore → pick that backup → restore. A backup you have restored once is one
   you can trust.

## What you have at the end of this part

Automatic, verified, versioned backups to your private repo with a full history, a tested restore, and a Today card
that tells you at a glance whether you are covered.
