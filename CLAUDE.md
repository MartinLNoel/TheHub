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
- **Pushing `main` deploys to Martin's phone** (CI, then GitHub Pages): push only when Martin says so; commit freely.
- **No personal details in docs, comments or commit messages either** (his plans, results, routine, town): they go
  in `private/` (git-ignored) with a pointer. The history was cleaned once before the first push (2026-11-14).
- **The Fighter is a story Martin must not see ahead:** never show or quote a stage he has not unlocked
  (`src/modules/gym/story/season1.js` and `docs/fighter/` are spoilers).

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
| Writing Bulgarian content (alphabet, reading words, the book run, copyright) | `docs/bulgarian-content-guide.md` |
| Improving content from Martin's feedback and wrong answers; the Part 6 and Bulgarian content runs | `docs/content-loop.md` |
| Longer-term ideas | `docs/ROADMAP.md` |
| Recipes added by a Claude instance (the link format) | `docs/recipe-links.md` |
| The Gym's home plan (why it is what it is, loads, ladders, office days) | `src/modules/gym/program.js` (comments), CHANGELOG 0.8.2–0.9.1 |
| The Fighter's story, pixel art and real weather (SPOILERS) | `src/modules/gym/story/` (start with `season1.js`), CHANGELOG 0.9.0 |
| What is in `private/` (git-ignored): ISTQB notes and transfer files, a clone of the backup repo, screenshot tools | `docs/BACKLOG.md` (2026-11-14/15 sections) |

## Plan status (2026-11-17)
All plan parts are built except Part 7's book run. **TheHub is live** (https://martinlnoel.github.io/TheHub/, first
push 2026-11-14) and **in daily use on Martin's phone** since 2026-11-15: verified backups to the private
`thehub-backup` repo (token set, restore drill done), his ISTQB progress imported (Notion no longer needed), the
Gym's home plan on, a fresh start (gainz-tracker history not imported; gainz-tracker is to be retired).
**Live: 0.9.9** (2026-11-17, CI green): the weather on the home screen (0.9.7), food and calories in the Fridge with
recipes by link and the Gym's Protein tab read-only (0.9.8, whose own push failed CI; 0.9.9 adds the Gym redraw
fix). Martin's two Sunday-prep recipes were given to him as links (copies in `private/recipes/`). **Committed on local `main`, NOT pushed: 0.9.10** (Food and Recipes restyled as the Fridge, no "Ate it" on a recipe; Martin's feedback 2026-11-17). **Next: the rest
of the features decided 2026-11-16** (top section of `docs/BACKLOG.md`): the "today" strip and market session clock,
then the companion pet, then the economic calendar. Open with Martin: Q-4 (the Bulgarian book,
now named: "Learn Bulgarian the Easy Way", Doncheva, Zagorchev, Georgiev), Q-25, Q-26, and the older ones.
Where things stand and what is next: the top sections of `docs/BACKLOG.md`.

## Commands
`npm test` (unit, Vitest) · `npm run e2e` (Playwright, phone viewport; first run `npx playwright install chromium`)
· `npm run serve` (the app at http://localhost:4173/TheHub/). Bump `VERSION` in `src/version.js` **and** `sw.js`
whenever app files change; add every new app file to `PRECACHE` in `sw.js` (tests check both).
