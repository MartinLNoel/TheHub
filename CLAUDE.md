# TheHub

Martin's personal multi-module phone app (an installable web app on GitHub Pages): Gym, ISTQB study, Bulgarian and
Fridge, sharing one core for storage, verified backups, updates and a Today screen. Only Martin uses it.

## Where this file sits
This project's parent is the project hub, `C:\Users\marti\Documents\CLAUDE.md`. **When something significant
finishes here (a plan part, a module going live), update TheHub's entry there** (`C:\Users\marti\Documents\hub\update-project-entry.md`).

## Rules for every action
- **Never commit personal data, tokens, the Bulgarian course book or official ISTQB exam material.** Imports and
  exports go in the git-ignored `private/` folder. The repo is public.
- **Never lose stored data.** Any change to a module's data shape bumps its schema version and adds a migration with
  a test; the app backs up before migrating.
- **Vanilla JS ES modules, no framework, no build step.** npm is for dev tooling (tests) only.
- **Every bug fix ships with a test** that fails on the old code; every feature ships with tests. `main` deploys
  only when CI passes.
- **Work on the branch the plan part names**, and update the logs below before a session ends.
- Mobile first: design for a Samsung phone in portrait, touch targets at least 48 px, dark mode.

## Map: read this when the session is about...
| Topic | Read |
|---|---|
| What the app must do, and why | `SPEC.md` |
| Architecture, folder layout, data and module contracts | `docs/plans/part-0-overview.md` |
| Building the next part | `docs/plans/part-N-*.md` (the next unstarted one, per `docs/BACKLOG.md`) |
| Where things stand, what is next | `docs/BACKLOG.md` |
| What changed | `docs/CHANGELOG.md` |
| Open questions for Martin and every placeholder | `docs/QUESTIONS.md` |
| Writing ISTQB lessons, questions or cards (house style, copyright, file layout) | `docs/istqb-content-guide.md` |
| Improving content from Martin's feedback and wrong answers; the Part 6 content runs | `docs/content-loop.md` |
| Longer-term ideas | `docs/ROADMAP.md` |

## Plan status
Parts 0–8 written 2026-10-17. Parts 2 (core shell), 3 (verified backup and restore), 4 (Gym, from gainz-tracker)
and 5 (shared study engine, `src/core/study/README.md`) built 2026-10-17 and merged into local `main`; nothing
pushed yet (Part 1's repos, Part 3's token, Part 4's export, import and side-by-side week, and Part 5's Ask Claude
phone test are Martin's). Part 6a (ISTQB module, Notion progress import, content scaffolding with §3.1, the
content loop) built and merged 2026-10-17; Ch3 and Ch6 content written 2026-10-17 (version 0.6.1); next: the content runs Ch4, Ch5, Ch1–2 questions per
`docs/content-loop.md`. Bulgarian (Part 7) is gated on the course book.
Details: `docs/BACKLOG.md`.

## Commands
`npm test` (unit, Vitest) · `npm run e2e` (Playwright, phone viewport; first run `npx playwright install chromium`)
· `npm run serve` (the app at http://localhost:4173/TheHub/). Bump `VERSION` in `src/version.js` **and** `sw.js`
whenever app files change; add every new app file to `PRECACHE` in `sw.js` (tests check both).
