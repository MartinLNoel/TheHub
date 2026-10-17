# TheHub — Part 4: Gym Module (from gainz-tracker, with your history)

**Depends on:** Part 3
**Branch:** `part-4/gym` (in TheHub) and `export-button` (in gainz-tracker)
**Estimated effort:** 2–3 sessions

---

## USER ACTIONS REQUIRED

- Part 3 done, and your phone shows a green backup tick.
- Know **how you open gainz-tracker on your phone** (the address in Chrome, or a home-screen icon). Claude will ask.

Found on 2026-10-17: gainz-tracker keeps everything in Chrome's `localStorage` under `gainz_state`, and already has an
`exportBackup()` function (`app.js`, "EXPORT / IMPORT"), **but no button calls it**: only "Restore from JSON file" is
on screen. Step 1 below adds the button so you can get your history out.

---

## Instructions for Claude

> **IMPORTANT:** Start Claude Code from the TheHub directory:
> `C:\Users\marti\Documents\Education\TheHub`
>
> Copy everything below this box and paste it as your prompt to Claude.

---

### Prompt Start

You are building **TheHub** (read `CLAUDE.md`, `SPEC.md`, `docs/plans/part-0-overview.md`, then `docs/BACKLOG.md`).
This is **Part 4: the Gym module**, a port of Martin's existing app **gainz-tracker**
(`C:\Users\marti\Documents\Education\gainz-tracker`, vanilla JS: `index.html`, `style.css`, `app.js` about 1,300
lines, `CONVENTIONS.md`). Its program rules and coaching context are in Notion (links in gainz-tracker's
`CLAUDE.md`): read both pages with the Notion tools before changing behaviour. **The port must behave the same as
gainz-tracker**; it is not a redesign.

**Step 1 — get the history out (gainz-tracker repo).** Ask Martin how he opens gainz-tracker on his phone (which
address), and check how that address is served (for example GitHub Pages settings of `MartinLNoel/gainz-tracker`).
On a branch `export-button` in gainz-tracker, add a visible "⬇ Export all data (JSON)" button next to the existing
"Restore from JSON file" button, calling the existing `exportBackup()`. Make sure the export **excludes**
`gainz_notion_token` (it is in localStorage, not in `state`; confirm). Change nothing else. Tell Martin exactly how
to get the change onto his phone and to export the file, then save it on his PC as
`TheHub/private/gainz-export.json`. **Wait for him to confirm the file is there before Step 3's import tests use
its shape** (read its keys; never commit it).

**Step 2 — port (TheHub repo, branch `part-4/gym`).** Create `src/modules/gym/` following the module contract:
- Screens: Today's workout, Log, Fighter (10 stages, the SVG character), Protein, Check-in, as in gainz-tracker, in
  TheHub's shell and theme. Keep the program data (`PROGRAM`, `WORKOUTS`, `HOME_WORKOUTS`, `QUICK_FOODS`, `STAGES`)
  identical; move them to `src/modules/gym/program.js`.
- Data: the module's store holds what gainz `state` holds (`workoutLogs`, `proteinLogs`, `checkIns`, `myFoods`,
  `personalBests`, `bodyweight`, `phase`, ...). Drop gainz's one-time date fix and the Notion backup (TheHub's
  backup replaces it). Decide what to do with gainz's "pre-load historical workout data if starting fresh" block:
  keep only if the export does not already contain that history, and note the decision in `docs/CHANGELOG.md`.
- `validate`: every workout log has a date and exercises; counts are non-negative; dates parse.
- `todayCard`: today's planned workout (or rest day), sessions this week vs target, protein left today, streak.
- Wire the manifest shortcut "Log workout" to `#/gym/log`.

**Step 3 — import.** In Settings, "Import from gainz-tracker": read a gainz export file, map it into the Gym store,
show a preview (number of workouts, protein days, check-ins, current fighter stage), take a TheHub backup first,
then import. Importing twice must not duplicate entries.

**Tests (required):** unit tests for the mapping using a **synthetic** fixture with the same shape as the real export
(never the real file); duplicate-import protection; stage calculation and streak match gainz-tracker's functions
for the same input (port the original functions into a test helper and compare); `validate`. E2E: log a workout,
see it on Today and in Log; add protein; complete a check-in.

Update `docs/BACKLOG.md` and `docs/CHANGELOG.md`, bump the version, commit, push both branches.

### Prompt End

---

## USER ACTIONS after Claude finishes

1. Merge and deploy both changes; on the phone, export from gainz-tracker (if not done in Step 1) and import into
   TheHub: **Settings → Import from gainz-tracker**.
2. Compare: open gainz-tracker and TheHub side by side. Same number of workouts, same fighter stage, same protein for
   today?
3. **Use TheHub for your workouts for one week.** Keep gainz-tracker installed but stop logging there.
4. After that week, if nothing is missing: tell Claude to archive gainz-tracker (README note "replaced by TheHub",
   GitHub repo set to archived, its `CLAUDE.md` pointing to TheHub, and the hub entry updated).

## What you have at the end of this part

Your gym app inside TheHub, with your full history, backed up daily and verified. gainz-tracker retired after a week
of side-by-side use.
