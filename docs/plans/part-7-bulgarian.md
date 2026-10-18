# TheHub — Part 7: Bulgarian Module

**Depends on:** Part 6
**Branch:** `part-7/bulgarian`
**Estimated effort:** 2–4 sessions, plus content per book chapter
**⛔ Gated: start only when the course book is available.** On 2026-10-17 Martin does not have it yet.

---

## Built before the book (2026-10-18)

Built autonomously on branch `part-7/bulgarian-prebook` (version 0.8.1), merged into local `main`, not pushed.
Only what does not depend on the book; nothing pretends to follow it.

**Done:**
- `src/modules/bulgarian/` on the shared study engine (no fork; four small engine hooks: `tabs`, `cardExtras`,
  `onCardGraded`, `feedbackTitle`). Home: words learned, streak, cards due, alphabet progress, the "From my home"
  deck, and a **"Lessons start when your course book is added"** panel in place of lessons. Two-way cards (each
  direction scheduled separately), Ask Claude and Feedback from the engine. Today card: cards due, alphabet
  progress, streak.
- **Cyrillic alphabet trainer** (`#/bulgarian/alphabet`): the 30 letters (upper and lower case), each with its
  sound, an English approximation, an example word and, for Е, О, Щ, Ъ and Ь, where Bulgarian differs from
  Russian; practice rounds of 10: letter → sound, sound → letter, and reading practice on 42 everyday words
  (greetings, courtesy, numbers 1–10, food and drink, people, places), all our own selection.
- **"From my home" deck**: `accept(item, data)` turns the Fridge's `hub.offer('bulgarian', { bg, en, topic })`
  into a two-way card, `null` for a duplicate. Item 3 above is done.
- **Pronunciation** (item 2): a 🔊 button through `speechSynthesis`, shown only when a `bg-BG` voice exists at
  runtime; Settings → Diagnostics says whether one does. Not yet tried on the phone (Q-22).
- Content `content/bulgarian/` (manifest with empty `chapters`, lessons, questions and cards; `alphabet.json`;
  `reading.json`; `handled-feedback.json`), validated by `tests/unit/bulgarian.test.js`. House style and the book
  run: `docs/bulgarian-content-guide.md`. Content loop: extended (item 5 done).

**Still for the book run** (after the USER ACTIONS below): the course map with Martin; lessons, vocabulary cards
and chapter quizzes per chapter in the book's order (item 4); the lesson UI (session card, Lessons tab, chapter
progress, "next lesson" on Today; item 1's lessons and quizzes); e2e for a lesson; Martin checks chapter 1 before
more is written. Start from `docs/bulgarian-content-guide.md`, "The book run", on a branch `part-7/bulgarian`.

---

## USER ACTIONS REQUIRED

1. **Get the course book as a file**: a PDF, or clear photos of each page (one file per page, named in order).
2. Put it in `C:\Users\marti\Documents\Education\Bulgarian\` (the private Bulgarian project folder), **not** in
   TheHub: the book is copyrighted and TheHub's repo is public.
3. Read `C:\Users\marti\Documents\Education\Bulgarian\` (its spec) once and tell Claude anything that has changed
   (your level, how many minutes per session, what you want first: script, speaking, vocabulary).

---

## Instructions for Claude

> **IMPORTANT:** Start Claude Code from the project directory:
> `C:\Users\marti\Documents\Education\TheHub`
>
> Copy everything below this box and paste it as your prompt to Claude.

---

### Prompt Start

You are building **TheHub** (read `CLAUDE.md`, `SPEC.md`, `docs/plans/part-0-overview.md`, then `docs/BACKLOG.md`).
This is **Part 7: the Bulgarian module**, on the shared study engine from Part 5 (already used by the ISTQB module;
reuse it, do not fork it). Martin is a beginner. His course book (the canonical
source) and the original spec are in `C:\Users\marti\Documents\Education\Bulgarian\`. Read the spec and the book's
table of contents first, and agree with Martin on the course map (chapters, what each teaches) before writing
content. Create branch `part-7/bulgarian` from `main`.

**Build:**
1. `src/modules/bulgarian/`: Home (chapter progress, words learned, streak), lessons per book chapter, two-way
   vocabulary cards (Bulgarian ↔ English), a Cyrillic alphabet trainer (letter ↔ sound, reading practice), short
   quizzes per chapter, Ask Claude and Feedback (from the engine). `todayCard`: cards due, next lesson.
2. Pronunciation: try the browser's speech synthesis for Bulgarian (`speechSynthesis`, voice `bg-BG`) on Martin's
   phone; if a Bulgarian voice exists, add a 🔊 button on cards; if not, record that in `docs/BACKLOG.md` and skip.
3. Accept items offered by other modules through `hub.offer('bulgarian', { bg, en, topic })` (the Fridge sends
   food words in Part 8) into a "From my home" card deck. *(Part 8 built the core side: give the module an
   `accept(item, data)` that returns the new data, or `null` for a duplicate; see Part 0, "The module contract".)*
4. Content in `content/bulgarian/`, **in your own words, following the book's order and vocabulary**. Do not copy
   the book's texts, exercises or dialogues into the repo; vocabulary lists of single words with translations are
   fine. Have Martin check the first chapter before writing more. Commit per chapter.
5. Extend `docs/content-loop.md` with the Bulgarian course.

**Tests (required):** content validation; Cyrillic renders and round-trips through backup and export unchanged;
two-way cards schedule each direction separately; `hub.offer` adds and de-duplicates. E2E: a lesson, a card session,
the alphabet trainer.

Update `docs/BACKLOG.md` and `docs/CHANGELOG.md`, bump the version, commit, push the branch.

### Prompt End

---

## USER ACTIONS after Claude finishes

1. Merge and deploy; do the first lesson and a card session on the phone.
2. Give feedback through the app; run the content loop after the first week.
3. Update the Bulgarian project's entry in the hub to say it now lives in TheHub.

## What you have at the end of this part

A Bulgarian course that follows your book, with spaced-repetition vocabulary, a Cyrillic trainer, Ask Claude for
questions, and a deck that will fill with words from your own kitchen.
