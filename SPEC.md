# TheHub — Specification

*Agreed with Martin 2026-10-17.*

## Goal

One app on Martin's Samsung (Android) phone that runs his personal projects as **modules**: training, studying and
household. It is for *using* them every day, not only for tracking them. One home screen ("Today") shows what each
module needs from him today.

## User

Martin only. No accounts, no login, no sharing, no syncing between people.

## Platform

- An installable **web app (PWA)**: vanilla JavaScript (ES modules), HTML and CSS. No framework, no build step.
- Hosted free on **GitHub Pages**, from the public repo `MartinLNoel/TheHub`.
- Installed from Chrome to the home screen; opens full-screen and works offline.
- Developer tooling (tests) uses npm, but the app itself ships as plain files.

## Hard requirements

### 1. Easy updates
- A push to `main` runs the tests in GitHub Actions; **only if they pass** does the site deploy to Pages.
- The phone picks up the new version on next open and shows **"Update available, tap to refresh."**
- Every module's stored data has a **schema version**. When an update changes the data's shape, the app takes a
  backup first, then converts the data. An update must never lose data.

### 2. Valid backups
- Backups go to a **private GitHub repo** `MartinLNoel/thehub-backup`, one commit per backup, so every past backup
  stays in git history.
- **Automatic**: when the app opens or comes back to the foreground and the last good backup is more than 24 hours
  old, it backs up. (A web app cannot reliably run in the background, so "daily" means "on the first use of the day".)
- A backup counts as **valid** only when it carries a schema version and a SHA-256 checksum, and the app has
  **test-restored it into a scratch copy** and found every module's data complete.
- The Today screen shows **"Last verified backup: <time> ✓"**, and turns red after 48 hours without one.
- **Restore** from the latest backup or any past one (chosen from the repo's history) is a real, tested feature.
- A second copy: a **monthly reminder to export everything** to a file on the phone.
- The backup token is a fine-grained GitHub token limited to `thehub-backup`, Contents read/write only, stored only
  on the phone, never in the repo. The app warns two weeks before it expires.

### 3. Easy access
- Home-screen icon with long-press shortcuts: **Log workout · Study · Scan item**.
- Opens on **Today**; the common action of each module is one tap from there.
- Large touch targets (at least 48 px), dark mode, readable text that respects the phone's font size.

### 4. No running costs
- No paid APIs, no servers. Hosting (GitHub Pages) and backup (GitHub) are free.
- AI help uses Martin's **existing Claude subscription**, through the "Ask Claude" button and Claude Code sessions.

## Architecture

### Core (`src/core/`)
- **Storage**: IndexedDB, one object store per module, each with a schema version and migrations.
- **Backup and restore** (see above).
- **Updates**: service worker, offline cache, update banner.
- **Module registry**: a module declares its id, name, icon, screens, Today card, schema version and migrations.
- **Today screen**: one card per module, plus the backup status.
- **Export / import** of everything as one JSON file.

### Shared study engine (`src/core/study/`), used by ISTQB and Bulgarian
- **Lessons**: content written ahead of time and shipped with the app.
- **Flashcards with spaced repetition**: two-way cards, full Unicode (Cyrillic), room for audio later.
- **Question bank**: multiple choice, tagged by topic (for ISTQB, learning objective and K-level).
- **Quiz and timed mock runner**, with binary scoring.
- **Mastery tracking** per topic, which steers which questions and cards come up.
- **Ask Claude**: one button builds a message with the full context (lesson, question, Martin's answer, the correct
  one) and hands it to the Claude app. The goal is "tap, and Claude opens with the message in it"; the route is
  chosen and tested on the phone in Part 5.
- **Feedback notes** on any lesson or question, stored and backed up with everything else.

### Content loop
Studying needs no AI while it happens. Periodically Martin runs a **Claude Code session** that reads his feedback
notes and wrong answers (from the backup repo), rewrites weak lessons and writes new questions aimed at his mistakes.
The changes ship as a normal update. The procedure is written down in Part 6.

## Modules (in build order)

1. **🏋️ Gym**: everything gainz-tracker does today (Today's workout, Log, Fighter progression with 10 stages, Protein,
   weekly Check-in), with the same program rules. Its existing history on the phone is brought over by export and
   import.
2. **🧪 ISTQB CTFL v4**: the v2 course continues **inside the app** from v2 Session 10 (Chapter 3). Progress is
   imported once from Notion (resetting is acceptable if the import is not possible, but keeping it is the goal).
   Content is written for Chapters 3–6 only; Chapters 1–2 are done and are not rewritten. Includes chapter
   mini-mocks, 40-question / 60-minute full mocks with the official chapter weighting, and the readiness gate (two
   consecutive full mocks at 80% or more).
3. **🇧🇬 Bulgarian**: lessons and vocabulary following Martin's beginner course book, Cyrillic practice, two-way
   flashcards. **Gated: starts when the course book is available.**
4. **🧊 Fridge**: barcode scanning with the phone camera (Open Food Facts lookups), expiry dates, "expiring soon" on
   Today. Each item's Bulgarian name can become a Bulgarian flashcard. Text only, no photos.

## Data rules

- The **public repo** holds code and Martin's own lesson and question text only.
- **Never in the public repo**: personal data (progress, logs, feedback), the Bulgarian course book, official ISTQB
  exam material (sample exams and their answers), tokens.
- Personal data lives on the phone and in the private backup repo.
- Imports (gainz-tracker history, ISTQB progress) are made as local files in the git-ignored `private/` folder and
  loaded through the app's import screen.

## Out of scope for v1

More than one user, syncing between devices, a live AI tutor inside the app, push notifications (they need a
server), photos, an app-store release.

## Done means

Martin uses TheHub every day instead of gainz-tracker and the Claude Project tutor; ISTQB study continues from his
real progress; backups are verified daily; an update is one push.

## Build plan

See `docs/plans/`. Part 0 is the architecture reference; Parts 1–8 are built in order.
