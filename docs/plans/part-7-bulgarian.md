# TheHub — Part 7: Bulgarian Module

**Depends on:** Part 6
**Branch:** `part-7/bulgarian`
**Estimated effort:** 2–4 sessions, plus content per book chapter
**⛔ Gated: start only when the course book is available.** On 2026-10-17 Martin does not have it yet.

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
