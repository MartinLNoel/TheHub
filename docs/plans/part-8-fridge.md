# TheHub — Part 8: Fridge Module

**Depends on:** Part 7 (only for the Bulgarian word link; if Part 7 is still waiting for the book, Part 8 can be
built first and the link switched on later, since `hub.offer` is ignored when no module accepts it)
**Branch:** `part-8/fridge`
**Estimated effort:** 2–3 sessions

---

## USER ACTIONS REQUIRED

- Have a few products with barcodes at hand for testing on the phone.

---

## Instructions for Claude

> **IMPORTANT:** Start Claude Code from the project directory:
> `C:\Users\marti\Documents\Education\TheHub`
>
> Copy everything below this box and paste it as your prompt to Claude.

---

### Prompt Start

You are building **TheHub** (read `CLAUDE.md`, `SPEC.md`, `docs/plans/part-0-overview.md`, then `docs/BACKLOG.md`).
This is **Part 8: the Fridge module**. An earlier standalone plan exists in `C:\Users\marti\Documents\Education\MiniFridge\`
(a React Native + Expo plan that is **superseded**: reuse its feature list and Open Food Facts research, not its
technology). Create branch `part-8/fridge` from `main`.

**Build:**
1. `src/modules/fridge/`: items with name, location (fridge / freezer / pantry), quantity, expiry date, added date;
   lists sorted by expiry; mark used / thrown away (keep a simple waste count).
2. **Scan** (`#/fridge/scan`, the manifest shortcut): camera barcode scanning of EAN-13 / EAN-8 / UPC. Use the
   browser's `BarcodeDetector` when available (check `getSupportedFormats()` on Martin's phone); otherwise fall back
   to a small, pinned-version open-source scanner library vendored into the repo. Look the code up on Open Food
   Facts (`https://world.openfoodfacts.org/api/v2/product/<code>`, with a descriptive `User-Agent`-style app name
   in the request as their API asks), prefill name and brand, and let Martin set the expiry date. Offline: save the
   barcode and look it up later. Manual entry always available.
3. `todayCard`: items expiring today and in the next 2 days.
4. Bulgarian link: when an item is added, offer its name to the Bulgarian module with `hub.offer('bulgarian', …)`
   (Martin confirms or edits the Bulgarian word; if the product data has a Bulgarian name, prefill it).
5. Text only: no photos are stored.

**Tests (required):** expiry sorting and the 2-day window; offline scan is queued and resolved later; Open Food Facts
responses (mocked: found, not found, error) map correctly; `hub.offer` called with the right item; `validate`. E2E:
add by manual entry; scan with a mocked camera / detector; item appears on Today when it expires soon.

Update `docs/BACKLOG.md` and `docs/CHANGELOG.md`, bump the version, commit, push the branch.

### Prompt End

---

## USER ACTIONS after Claude finishes

1. Merge and deploy; scan five real products and check names and expiry handling.
2. Add a "superseded by TheHub" note to `MiniFridge`'s spec and update its hub entry.

## What you have at the end of this part

A fridge and pantry tracker with barcode scanning and expiry warnings on Today, whose items also teach you their
Bulgarian names.
