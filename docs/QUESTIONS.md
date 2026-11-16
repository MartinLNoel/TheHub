# Questions for Martin

Built while Martin was away (from 2026-10-17). Every placeholder in the code or docs is listed here with where it is
and what answer replaces it. Search the repo for `PLACEHOLDER(` to find them all.

Format: **Q-n** · the question · why it matters · where the placeholder is · status (open / answered).

## Open

- **Q-1** · Have you done ISTQB sessions in the Claude Project after the last one saved in Notion? If yes, which is
  the newest session number? · The progress import starts from the newest v2 state page. · Part 6 import · open
  - *Found 2026-10-17 (Notion read-only):* details in `private/istqb-notes.md` (private): no newer session was saved, so
    TheHub continues from the last saved one. If a later session got further, tell Claude: the extract can be
    adjusted and the file rebuilt with `node scripts/istqb-import.mjs`. SR-2 is honoured (a unit test bans
    mnemonics in stems).
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
- **Q-4** · Bulgarian course book: **named 2026-11-15:** "Learn Bulgarian the Easy Way" (Doncheva, Zagorchev,
  Georgiev; ISBN 978-954-9351-87-3). Do you have a copy (paper or PDF), and with the CDs? The first step is the course
  map, from the book's table of contents: photos of the contents pages are enough to start. Keep the book and any
  scans in `C:\Users\marti\Documents\Education\Bulgarian\`, never in TheHub (public repo); lessons are written in
  our own words. The app side is ready (0.9.6): lessons appear as soon as chapter 1 is written. · Part 7's lessons
  follow it. · Part 7 · open
  - *2026-10-18:* everything that does not need the book is built (version 0.8.1): the module, the alphabet
    trainer, reading practice, the "From my home" deck and the 🔊 button. The home says "Lessons start when your
    course book is added". When you have it, put it in `C:\Users\marti\Documents\Education\Bulgarian\` (not
    TheHub) and start the book run (`docs/bulgarian-content-guide.md`).
- **Q-5** · App icon and colours: Part 2 ships a generated placeholder icon (a white "hub" wheel on blue, #2f6fde)
  and a neutral blue accent. Do you want a different icon or colour? · It is what you see on the home screen. ·
  `scripts/make-icons.mjs` (regenerate with `npm run icons`), `icons/`, `style.css` tokens · open
- **Q-6** · Version numbers: Part 2 starts at `0.2.0` and the plan is to bump the middle number per plan part and the
  last number per fix, reaching `1.0.0` when you use TheHub daily. OK? · The version shows in Settings and names the
  offline cache. · `src/version.js` (and `sw.js`) · open
  - *2026-10-18:* Part 7's book-free half shipped as **0.8.1**, not 0.7.0: the Fridge already took 0.8.0, and a
    lower number would read as a downgrade. The book run continues from there (0.8.2, …) unless you prefer otherwise.
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
- **Q-10** · gainz-tracker pre-loaded your first 7 sessions (spring 2026) whenever its workout list was
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
  - *Note 2026-10-18 (Q-18 fix):* the core now has one local-date helper, `src/core/dates.js` (`localDate`,
    `addDays`, `daysBetween`), used by the study engine. If you say yes to (1), the switch is small: `todayISO`
    in `src/modules/gym/logic.js` (and `loggedToday` in `src/modules/gym/index.js`) call `localDate(now)`; the
    stored Gym dates keep their `YYYY-MM-DD` shape, so no migration. The Gym was left on UTC for now.
- **Q-12** · Small Part 4 choices: the Gym's own tabs are **Workout · History · Fighter · Protein · Check-in**
  (gainz calls the first two Today and Log; renamed so they do not clash with TheHub's Today, and so "Log workout"
  = `#/gym/log` opens the logging screen); the gainz Notion backup and its setup screen are gone (TheHub's backup
  replaces them; Check-in links to Settings instead); gainz's fonts and yellow accent became TheHub's theme (the
  Fighter keeps its own colours); the Today card says "Rest day" once the week's target is met. OK? · Fidelity of
  the port. · `src/modules/gym/screens.js`, `src/modules/gym/index.js` · open
- **Q-13** · **Ask Claude on your phone: which delivery works?** After the first push (Part 1), open TheHub →
  **Settings → Ask Claude** and tap the three test buttons: **Test: Share sheet** (does Claude appear in the
  Android share list, and does the text land in a new chat?), **Test: Link (experimental)** (opens
  `https://claude.ai/new?q=…`: undocumented; does the message appear filled in?), **Test: Copy and open Claude**
  (does the Claude app open, and does pasting work?). Tell Claude which work. · The goal is "tap, and Claude opens
  with the message in it". Built while you were away, none of the three could be tried on the phone. Defaults:
  share sheet when the phone has one (with "Copy instead" next to it), the link only if you choose it in Settings
  (support.claude.com article 14898120, checked 2026-10-17, documents prefill links only for Claude Code), and
  "copy" opens the app through the Android intent
  `intent://claude.ai/new#Intent;scheme=https;package=com.anthropic.claude;…` (the package name
  `com.anthropic.claude` is unverified; elsewhere `https://claude.ai/new`). Record the results in
  `docs/BACKLOG.md` and make the working one the default. · `src/core/study/ask-claude.js` (`DEFAULT_DELIVERY`,
  `CLAUDE_ANDROID_INTENT`, `PREFILL_URL`) · open
- **Q-14** · Study engine defaults, chosen while you were away (Part 6 can change them per course): a session has
  up to **4** review-drill items, a **5**-question quiz and **2** delayed-retrieval questions; below **65 %** on the
  quiz the same lesson is taught again next session (the tutor prompt's "slow down, re-teach"); mastery: all
  correct → *solid*, and *solid* → *exam-ready* only when the objective was also answered right in an earlier
  session; half or more → *untested* becomes *shaky*, *exam-ready* drops to *solid*; under half → *shaky*;
  flashcards: SM-2 with Again/Hard/Good/Easy and **10** new card sides a day. OK? · How sessions feel and how fast
  objectives reach exam-ready. · `src/core/study/session.js` `SESSION_DEFAULTS`, `src/core/study/progress.js`
  `nextMastery`, `src/core/study/scheduler.js` · open

- **Q-15** · Your ISTQB progress was imported per objective (all 64). Notion kept the ledger per *topic*
  ("FL-2.2.x acceptance vs system", "Ch5: 6 solid/exam-ready"), so Claude mapped it: each LO takes the weakest
  status of the topics inside it, and LOs with only v1 evidence keep the Legacy Analysis verdict (*solid* =
  re-verify). The result is in `private/istqb-notes.md`. OK, or should
  Ch3–6 LOs that were only "solid" in the inflated v1 run start as *untested*? · Which questions come up first
  and when objectives reach exam-ready. · `private/istqb-notion-extract.json` (`ledger`, `ledgerNotes`),
  `scripts/istqb-import.mjs` · open
- **Q-16** · ISTQB defaults chosen while you were away: a chapter mini-mock is **10 questions in 15 minutes, 7
  from the chapter and 3 cumulative**, and **≥ 65 % banks the chapter** (the tutor's "7/10"); a full mock counts
  for the readiness gate only when it has all **40** questions (until the bank is complete, full mocks are short
  and never count); the 10-day warm-up uses only objectives already studied (so it starts working once the
  Chapter 1–2 questions exist); readiness levels: *Ready* = last two complete full mocks ≥ 80 %, *Approaching* =
  all chapters banked or the latest full mock passed, *Building* = any study. OK? · How mocks and the gate feel. ·
  `src/modules/istqb/rules.js` · open
- **Q-19** · **Barcode scanning on your phone: please test it.** Built while you were away; no real camera or
  phone could be tried. After the first push: (1) open TheHub → **Settings → Diagnostics** and send Claude the
  "BarcodeDetector …" line (it lists what `BarcodeDetector.getSupportedFormats()` reports; Chrome on Android
  normally includes `ean_13`); (2) **Fridge → 📷 Scan item** (or long-press the icon → Scan item): allow the camera,
  scan five real products, and note for each whether it read, how fast, and whether the name was right. The scan
  screen says which reader it used ("the phone's own" or "TheHub's built-in reader (zxing)"). · If the phone's own
  reader is missing, the fallback (barcode-detector 3.2.2 with zxing-wasm 3.1.3, MIT; zxing-cpp Apache 2.0,
  vendored in `src/vendor/barcode-detector/`, about 1.1 MB, cached for offline use) takes over; it was proven only
  in desktop Chromium against a drawn EAN-13. · `src/modules/fridge/scanner.js`, `src/core/diagnostics.js` · open
- **Q-20** · **Open Food Facts from a web app.** OFF asks apps to identify themselves with a `User-Agent` such as
  "AppName/Version (contact)". A browser cannot set that header (and a custom header would make Chrome send a CORS
  preflight that OFF may refuse), so TheHub sends `app_name=TheHub&app_version=<version>` in the query instead,
  with no contact address (your e-mail would then sit in a public repo and in every request). Unverified: that OFF
  accepts this from a browser (CORS on `/api/v2/product/`), and its read limit (about 100 product reads a minute,
  from memory; TheHub makes one per scan and at most 10 per "Look up now"). No test has called OFF: all are mocked.
  If the first real scans say "Offline (or Open Food Facts did not answer)" while you are online, tell Claude. ·
  Names prefilled or not. · `src/modules/fridge/off.js` (`productUrl`) · open
- **Q-21** · Fridge defaults chosen while you were away: three places (**Fridge, Freezer, Pantry**; MiniFridge also
  had shelves and a counter); "expiring soon" on Today = **today and the next 2 days, plus anything already
  expired**; the waste count is two totals (**used up / thrown away**; "Remove (added by mistake)" counts neither);
  expiry is optional (rice, salt) and has quick buttons (Today, +3 days, +1 week, +1 month); dates show as
  DD-MM-YYYY; the name Open Food Facts gives is the product's main-language name (often Dutch), with its English name
  offered as the English side of a Bulgarian card; Fridge words reach Bulgarian with `topic: 'food'`. OK? · How
  the Fridge and its Today card behave. · `src/modules/fridge/data.js` (`LOCATIONS`, `SOON_DAYS`, `OFFER_TOPIC`),
  `src/modules/fridge/screens.js` · open
- **Q-22** · **Is there a Bulgarian voice on your phone?** After the first push, open TheHub → **Settings →
  Diagnostics** and send Claude the "Speech voice bg-BG: …" line. If it says *available*, open Bulgarian →
  Alphabet → a letter, tap 🔊 and say whether it sounds Bulgarian (and whether it works in aeroplane mode: the line
  says "online" for a voice that needs the network). If it says *not available*: Android's text-to-speech settings
  (Google's speech engine → install voice data → Bulgarian; the menu names differ per phone, unverified) may add
  one; then check the line again. · The 🔊 buttons show only when a `bg-BG` voice exists (a non-Bulgarian voice
  would teach the wrong sounds). Built while you were away, so no real voice was tried: the tests use mocked
  voices. Record the answer in `docs/BACKLOG.md`. · `src/core/speech.js`, `src/core/diagnostics.js` · open
- **Q-23** · Bulgarian trainer defaults, chosen while you were away: a letter counts as **learned** after **2
  right answers in a row in both directions** (letter → sound and sound → letter; a miss starts that direction
  again); a practice round has **10** questions, letters you do not know yet first; the app writes Ъ as **"ă"** in
  Latin (official signs write "a", as in Targovishte); the 42 reading words (greetings, numbers, food…) are for
  reading practice only and are **not flashcards**, because the spec says vocabulary comes from the book (say if
  you want them as a starter deck); new cards: **10 sides a day** (5 two-way words); a Fridge word is declined when
  it has no Cyrillic letter or is already a card. OK? · How fast the alphabet counts as learned, and what you can
  review before the book arrives. · `src/modules/bulgarian/data.js` (`LEARNED_STREAK`, `ROUND_SIZE`,
  `acceptOffer`), `src/modules/bulgarian/screens.js` (`CARDS`), `content/bulgarian/alphabet.json` (`latin`) · open
- **Q-29** · Which currencies in the economic calendar? **Answered 2026-11-16:** yes to the proposal, high-impact
  events only for USD, EUR, GBP and JPY, changeable in Settings. · to build · answered
- **Q-28** · What should the companion pet look like? **Answered 2026-11-16: "Surprise me."** Claude designs it;
  do not show Martin sketches first. · to build · answered
- **Q-27** · Your daily calorie target. **Answered 2026-11-16: Martin does not know.** Proposal for the build: the
  app suggests a starting number from his weight (a maintenance estimate, shown as such) and lets him change it; for
  the first two weeks the kcal ring shows the day's total against it without "target missed" messages, so the
  number can be adjusted to what he really eats. Revisit with him after two weeks. · to build · answered
- **Q-26** · The Fridge does what its spec asked (scan, expiry, "expiring soon", Bulgarian names) and reads
  cleanly; nothing in it was changed overnight. Should it grow? Ideas: a shopping list (items you used up or threw
  away go on it), or "what can I cook" from what is in the fridge. Or leave it as it is until you have used it. ·
  What the Fridge is for. · `src/modules/fridge/` · open
- **Q-25** · Gym → Check-in → **Coach notes** still carry gainz-tracker's targets: "Weight gain target — aim for
  0.25–0.5kg/week" and "Calorie target — aim for 2900–3100 kcal/day". Your coaching rules say no calorie counting
  for now, and your goals now include a tight stomach. Keep them, change the numbers, or remove those two notes? ·
  What the Check-in screen tells you. · `src/modules/gym/screens.js` (renderCheckin, "Coach notes") · open
- **Q-24** · Gym home plan: what goes in the kg boxes. **Answered 2026-11-14:** the plates on one dumbbell, the
  handle not counted (Martin's way; one set of dumbbells, so the numbers only need to agree with themselves);
  bodyweight moves 0 kg; holds in seconds in "reps"; the ladders now record their step (Martin: "that rule is
  fine"). Each load shows the kg to type. · `src/modules/gym/program.js` (`HOME_PLAN`, `LADDERS`) · answered
- **Q-18** · **Bug found (not fixed: the Ch4 content run may only edit content, tests and docs).** A study session
  is saved with its **UTC** date (`finishSession`: `new Date(now).toISOString().slice(0, 10)`), but the ISTQB home
  compares it with the **local** date (`daysSinceLastSession` uses `localISO`). Between midnight and 01:00 (02:00
  in summer) Dutch time, a session just finished shows "Last session: 1 day ago", and the 10-day warm-up count can
  be off by a day. Found 2026-10-18 at 00:20 CEST: the e2e test "import progress, then a session" fails at that
  hour on this branch **and on the base commit d560a69**; with the browser in UTC all 41 e2e tests pass. Proposed
  fix (next code session): store the local date (`localISO`) in `finishSession`, with a unit test at 23:30 UTC.
  Same family as Q-11 (the Gym's UTC "today"). OK to fix that way? · Wrong "last session" and warm-up day count
  late at night. · `src/core/study/session.js` (`finishSession`, `date:`), `src/modules/istqb/rules.js`
  `daysSinceLastSession` (no PLACEHOLDER marker added: code was out of scope) · **answered (fixed 2026-10-18)**
  - *Done 2026-10-18 (version 0.6.3, branch `fix/local-date`), as proposed, without waiting for an answer (a
    plain bug):* new `src/core/dates.js` (`localDate`, `addDays`, `daysBetween`); `finishSession` and
    `finishMock` store `localDate(now)`; `daysSinceLastSession` uses `daysBetween`. Tests: `tests/unit/local-date.test.js`
    (failed before the fix) and the e2e "import progress, then a session" pinned to Amsterdam at 00:20 (failed
    before). No migration: the stored shape is unchanged and no old-code dates exist on the phone (CHANGELOG).
    The Gym is untouched (Q-11).
