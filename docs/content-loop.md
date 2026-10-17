# The content loop

Studying in TheHub needs no AI. Every week or two, Martin runs **one Claude Code session** that turns his feedback
notes and wrong answers into better lessons and questions, and ships them as a normal update. It costs nothing
beyond his Claude subscription. This file is the procedure and the prompt.

Also used for the remaining **Part 6 content runs** (Chapter 3, Chapter 4, Chapters 5–6, then Chapters 1–2
questions only): the same prompt, with the run named in the first line (see "Content runs" below).

## What the session needs

- TheHub on the PC (`C:\Users\marti\Documents\Education\TheHub`), on `main`, tests passing.
- Read access to the private backup repo `MartinLNoel/thehub-backup` (the phone backs up there daily). Its
  `backup.json` holds `modules.istqb.data`: `feedback` (Martin's notes, each with an `id`, `targetId` = a lesson,
  question or card id, `targetKind`, `text`, `resolved`) and `attempts` (every answer: `questionId`, `objective`,
  `chosen`, `correct`, `kind`, `sessionNo`; imported Claude Project answers carry `legacyText`).
- The house style: `docs/istqb-content-guide.md`, and `private/istqb-notes.md` if it exists.

## The procedure

1. **Get the data, privately.** Clone or pull `MartinLNoel/thehub-backup` into `private/thehub-backup/` (git-ignored;
   check with `git check-ignore private/thehub-backup`). Read `backup.json`. **Never copy it, or any of Martin's
   answers or notes, into a tracked file**; quote nothing personal in commits.
2. **List the work.**
   - Open feedback: `feedback` items with `resolved: false` whose `id` is not already in
     `content/istqb/handled-feedback.json`.
   - Wrong answers since the last loop (the CHANGELOG entry of the last loop gives its date): `attempts` with
     `correct: false`, grouped by `objective` and by `questionId`.
   - Weak spots: objectives answered wrong in two or more sessions, or whose questions are often missed.
3. **Fix what the feedback points at.** For each note, find its target (`targetId` = lesson id such as `3.1`,
   question id such as `q3.1.2-b`, or card id) and fix it in place: wrong facts, unclear wording, a defensible
   distractor, a typo. Keep ids unchanged (Martin's history points at them). If a note is a question rather than
   a problem, answer it inside the lesson (a short paragraph or an **Exam trap** line).
4. **Write new questions aimed at the mistakes.** For each weak objective, 2–4 new questions in novel scenarios,
   whose distractors are the very confusion Martin showed (the wrong option he chose, the informal term he used).
   Follow `docs/istqb-content-guide.md` (format, K-level, `chapter`, ids, no mnemonic in stems, own words, never
   official sample-exam questions). Add a flashcard when the mistake is a term.
5. **Mark the feedback handled.** Append each handled note's `id` to `content/istqb/handled-feedback.json` (a JSON
   list of strings). The app then shows those notes as "Handled in a content update". Notes you could not handle
   stay open: list them in the session's report to Martin.
6. **Test.** `npm test` and `npm run e2e` must pass. Read changed lessons at phone width (`npm run serve`).
7. **Ship.** Bump the version in `src/version.js` and `sw.js`; add a dated `docs/CHANGELOG.md` entry ("Content
   loop: N notes handled, M questions added, objectives …", no personal text); update `docs/BACKLOG.md`. Commit on a
   branch `content/<date>`, merge into `main` when green, push `main` (CI deploys; the phone shows "Update
   available").
8. **Report** to Martin: what changed, which notes stay open and why, which objectives look weakest now.

## Content runs (Part 6 Step 3)

Each run writes one part of the course, then follows steps 6–8 above:

| Run | Writes | Then |
|---|---|---|
| Ch3 (done 2026-10-17, with Ch6) | `lessons-ch3.json` (§3.2; §3.1 exists) and `questions-ch3.json` to ≥ 6 per LO | add `3` to `FINISHED_CHAPTERS` in `tests/unit/istqb.test.js` |
| Ch4 (done 2026-10-18) | `lessons-ch4.json` (4.1–4.5, 4.2 split into 4.2a/4.2b) and `questions-ch4.json` (≥ 6 per LO, ≥ 10 for the five K3) | added `4` |
| Ch5 (done 2026-10-18) | `lessons-ch5.json` (5.1 split into 5.1a/5.1b/5.1c, then 5.2–5.5) and `questions-ch5.json` (≥ 6 per LO, ≥ 10 for 5.1.4, 5.1.5, 5.5.1) | added `5` |
| Ch1–2 questions (done 2026-10-18) | `questions-ch1.json`, `questions-ch2.json` only, **no lessons** (≥ 6 per LO, 8–10 for the Legacy "extra drilling" LOs) | the ≥ 6 check now runs for all six chapters; the skipped whole-bank test was removed |

All four runs are done (2026-10-18): the bank covers every objective, so a full mock has its 40 questions with the
official weighting and counts for the readiness gate. From now on, content changes come from the content loop above.

## The prompt (paste into Claude Code, started in the TheHub folder)

```text
Run the TheHub content loop. Read CLAUDE.md, docs/content-loop.md (this procedure) and
docs/istqb-content-guide.md (the house style) first, then follow the procedure step by step.

Run: content loop  [or: Part 6 content run "Ch3" | "Ch4" | "Ch5–6" | "Ch1–2 questions"]

Rules: the backup repo MartinLNoel/thehub-backup goes into private/ only and is never committed; nothing
personal (my answers, notes, scores) goes into tracked files or commit messages. Write all content in your own
words; never copy syllabus text at length and never use official ISTQB sample-exam questions or answers. Verify
every worked example (boundaries, partitions, decision tables, state diagrams, coverage) by working it through.
Keep existing ids. Mark handled feedback in content/istqb/handled-feedback.json. Bump the version, run npm test
and npm run e2e, update docs/BACKLOG.md and docs/CHANGELOG.md, commit on a branch content/<today's date>, and
merge into main only when everything passes. Ask me before pushing. At the end, tell me what changed, which
feedback stays open and why, and my weakest objectives now.
```
