# Questions for Martin

Built while Martin was away (from 2026-10-17). Every placeholder in the code or docs is listed here with where it is
and what answer replaces it. Search the repo for `PLACEHOLDER(` to find them all.

Format: **Q-n** · the question · why it matters · where the placeholder is · status (open / answered).

## Open

- **Q-1** · Have you done ISTQB sessions in the Claude Project after the last one saved in Notion? If yes, which is
  the newest session number? · The progress import starts from the newest v2 state page. · Part 6 import · open
- **Q-2** · How do you open gainz-tracker on your phone: which address in Chrome (or is it a home-screen icon from a
  GitHub Pages address)? · Needed to get the new "Export all data" button onto your phone so your history can move
  to TheHub. · Part 4 · open
  - *Found while Martin was away (2026-10-17, not checked online: no external calls were allowed):* the repo
    `MartinLNoel/gainz-tracker` has `index.html` at the root of `main`, no `CNAME` and no workflow, which is what a
    GitHub Pages site "deployed from `main`, root" looks like; if so, the address is
    `https://martinlnoel.github.io/gainz-tracker/` (unverified: check the repo's Settings → Pages). The button is on
    the local branch **`export-button`** (commit c476b99, not merged, not pushed). To get it onto the phone: merge it
    into `main` and push; Pages republishes within a few minutes; reopen gainz-tracker (pull down to refresh) →
    Check-in → **⬇ Export all data (JSON)**, and copy the file to `TheHub/private/gainz-export.json` if you want a
    Claude session to look at it. Its export holds `state` only, never `gainz_notion_token` (checked by running the
    app in jsdom). If the download does not start on Android, tap again (gainz releases the file link straight after
    the click; left unchanged on purpose).
  - *Shortcut:* if gainz-tracker runs at `martinlnoel.github.io`, TheHub (same address, so same browser storage)
    can read gainz-tracker's data directly: Settings → Import from gainz-tracker then also shows **"Use the
    gainz-tracker data on this phone"**, and no file is needed. It reads only `gainz_state`. ·
    `src/modules/gym/import.js` `findGainzOnThisPhone`
- **Q-3** · Create the two GitHub repos (Part 1: public `TheHub`, private `thehub-backup` with a README) and set
  Pages to "GitHub Actions"; then push. Nothing has been pushed anywhere. · Nothing is online until this is done. ·
  Part 1 · open (action, not a question)
- **Q-4** · Bulgarian course book: still to find. · Part 7's lessons follow it. · Part 7 · open
- **Q-5** · App icon and colours: Part 2 ships a generated placeholder icon (a white "hub" wheel on blue, #2f6fde)
  and a neutral blue accent. Do you want a different icon or colour? · It is what you see on the home screen. ·
  `scripts/make-icons.mjs` (regenerate with `npm run icons`), `icons/`, `style.css` tokens · open
- **Q-6** · Version numbers: Part 2 starts at `0.2.0` and the plan is to bump the middle number per plan part and the
  last number per fix, reaching `1.0.0` when you use TheHub daily. OK? · The version shows in Settings and names the
  offline cache. · `src/version.js` (and `sw.js`) · open
- **Q-7** · The backup token is stored in the app's IndexedDB. Every GitHub Pages site you have lives on the same
  origin, `martinlnoel.github.io`, so in principle a script on another of your Pages sites could read it. Part 3
  accepts this (the token can only touch `thehub-backup`, Contents only, and the other sites are your own code). Do
  you want a custom domain (e.g. a subdomain you own) for TheHub later to isolate it? · Token safety. ·
  `src/core/backup.js` (top comment) · open
- **Q-8** · When an update converts a module's data and **backups are not set up** (no token), Part 3 **blocks** the
  conversion: that module shows an error until a token is entered and the backup succeeds. The alternative is to
  convert anyway after a warning. Keep blocking? · "Never lose stored data" vs. being locked out of a module. ·
  `src/core/backup.js` `beforeMigrate` · open
- **Q-9** · Two small defaults: the "monthly" export reminder appears 30 days after the last export (and always
  until the first one); the Restore list shows the newest 100 backups (older ones stay in git history, reachable
  by a Claude Code session). OK? · Reminder noise, restore reach. · `src/core/backup.js` `EXPORT_REMIND_AFTER`,
  `src/core/github.js` `listBackups` · open
- **Q-10** · gainz-tracker pre-loaded your first 7 sessions (23 Feb to 4 May 2026) whenever its workout list was
  empty, and saved them, so every gainz export should already hold them. TheHub **does not pre-load** them (a fresh
  Gym starts empty) and relies on your import instead, which also keeps that personal data out of the public repo.
  When your real export exists: does it hold those 7 sessions (the import preview shows the count; History lists
  them)? If not, a Claude Code session can build an import file with them from gainz-tracker's `app.js`. · Your
  history must be complete. · `src/modules/gym/data.js` `defaultData` · open
- **Q-11** · The port keeps two gainz-tracker quirks so both apps agree during the side-by-side week: (1) "today" is
  the **UTC** date, so a workout or protein logged between midnight and 01:00 (02:00 in summer) Dutch time counts
  for the day before; (2) Check-in's "This Week" counts from Sunday, while everything else (week target, streak,
  the Monday reset to Upper A) uses Monday to Sunday. Fix both after that week? · Late-night sessions land on the
  wrong day; a confusing count. · `src/modules/gym/logic.js` (`todayISO`, `checkinThisWeek`) · open
- **Q-12** · Small Part 4 choices: the Gym's own tabs are **Workout · History · Fighter · Protein · Check-in**
  (gainz calls the first two Today and Log; renamed so they do not clash with TheHub's Today, and so "Log workout"
  = `#/gym/log` opens the logging screen); the gainz Notion backup and its setup screen are gone (TheHub's backup
  replaces them; Check-in links to Settings instead); gainz's fonts and yellow accent became TheHub's theme (the
  Fighter keeps its own colours); the Today card says "Rest day" once the week's target is met. OK? · Fidelity of
  the port. · `src/modules/gym/screens.js`, `src/modules/gym/index.js` · open

## Answered

(none yet)
