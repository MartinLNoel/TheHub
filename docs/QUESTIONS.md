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

## Answered

(none yet)
