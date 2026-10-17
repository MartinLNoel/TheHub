# TheHub — Part 6: ISTQB Module (your progress, Chapters 3–6, the content loop)

**Depends on:** Part 5
**Branch:** `part-6/istqb`
**Estimated effort:** 3–5 sessions (most of it is writing content)

---

## USER ACTIONS REQUIRED

- Claude Code must have the **Notion connector** working (it reads your session pages once).

Found on 2026-10-17 in Notion: the newest saved v2 state page and the scores to date (both in
`private/istqb-notes.md`, git-ignored). Pages named `[v1]` and "SUPERSEDED" are old and must be ignored.

**If you studied after 21 July** in the Claude Project, tell Claude the newest session number at the start.

---

## Instructions for Claude

> **IMPORTANT:** Start Claude Code from the project directory:
> `C:\Users\marti\Documents\Education\TheHub`
>
> Copy everything below this box and paste it as your prompt to Claude.

---

### Prompt Start

You are building **TheHub** (read `CLAUDE.md`, `SPEC.md`, `docs/plans/part-0-overview.md`, then `docs/BACKLOG.md`).
This is **Part 6: the ISTQB CTFL v4 module**. Martin has been studying with a Claude Project tutor whose prompt is
`C:\Users\marti\Documents\Education\AI Study Programs\ISTQB_CTFL_Testing_Foundation\CTFL_v4_tutor_prompt.md` (the v2
re-teach). Read it fully: it is the specification for how this module teaches, quizzes and tracks. Martin wants to
**continue the same course inside TheHub**, keeping his progress. Create branch `part-6/istqb` from `main`.

**Step 1 — import his progress (once).** With the Notion tools, read Martin's session-states database, its newest **v2** state page (check for newer ones and ask Martin) and
the **Legacy Analysis** page (links in `private/istqb-notes.md`), and search for the **ISTQB Exam Style Guide** and **Official Question Pool
Index** pages. Ignore `[v1]` pages, "SUPERSEDED" pages and the v1 archive. Convert into the module's progress shape
(Part 0 "Study engine data"): per-LO `mastery` for all 64 objectives, `reviewQueue`, the wrong-answer log as
`attempts` (keep question text in a `legacyText` field), `sessions` with scores, `pointer` at the next section
(expected: v2 Session 10, Chapter 3 §3.1). Write it to `private/istqb-progress.json` (git-ignored, **never
committed**) in the TheHub backup format for the `istqb` module only, and show Martin a summary to confirm. Add a
Settings action "Import ISTQB progress" (it may reuse the generic import). If something cannot be mapped, say what
and ask; Martin accepts a reset as a last resort, but keeping progress is the goal.

**Step 2 — the module.** `src/modules/istqb/` on top of the study engine: Home (chapters X/6, readiness, next
session), "Start session" (the tutor prompt's 40-minute format), chapter mini-mock (10 questions, weighted to the
chapter with 2–3 cumulative), full mock (40 questions / 60 minutes, Ch1:8 Ch2:6 Ch3:4 Ch4:11 Ch5:9 Ch6:2), the
readiness gate (two consecutive full mocks ≥ 80%), wrong-answer review, flashcards for terminology and mnemonics,
the Feedback list. `todayCard`: next session, due review items, days since last session (after 10 days, the next
session opens with the 5-question warm-up as the tutor prompt says). Wire the "Study" shortcut.

**Step 3 — content for Chapters 3–6 only.** Martin has finished Chapters 1–2: **do not write lessons for them.**
Full mocks still need Ch1–2 questions: write questions for those chapters only. Write, in `content/istqb/`:
lessons for every section of Chapters 3–6 in the tutor prompt's style (short paragraphs, Unity/game-QA examples,
LO codes and K-levels, exact ISTQB terms with the informal phrasings flagged as traps), weighted by the Legacy
Analysis ("extra drilling" vs "standard depth"); a question bank covering **every** learning objective of all six
chapters, at least 6 questions per objective and more for K3 and the shaky ones, built per the Style Guide; and
flashcards for the terminology drill list and mnemonics. Rules: **write everything in your own words; never copy
syllabus text at length, and never include official ISTQB sample-exam questions or their answers** (the repo is
public; Martin keeps those PDFs privately). Verify every worked example (boundary values, coverage, decision tables,
state diagrams) by working it through before writing it. Content may be written over several sessions; commit per
chapter.

**Step 4 — the content loop.** Write `docs/content-loop.md`: the procedure Martin runs in a future Claude Code
session to improve content. It reads his feedback and wrong answers from the backup repo (clone
`MartinLNoel/thehub-backup` into `private/`, read `backup.json`, never commit it to TheHub), fixes or rewrites the
lessons and questions concerned, writes new questions aimed at his mistakes, marks feedback as handled (by id, in a
`content/istqb/handled-feedback.json` list the app reads to show it as resolved), runs the tests, and ships an
update. Include a ready-to-paste prompt. Link it from `CLAUDE.md`'s map.

**Tests (required):** content validation for every file; each objective has the minimum questions; full-mock
assembly uses the official weighting; the readiness gate; the 10-day warm-up rule; the progress import maps a
**synthetic** Notion-shaped fixture correctly. E2E: run a session, a mini-mock and a full mock at the phone
viewport.

Update `docs/BACKLOG.md` and `docs/CHANGELOG.md`, bump the version, commit, push the branch.

### Prompt End

---

## USER ACTIONS after Claude finishes

1. Merge and deploy. On the phone: **Settings → Import ISTQB progress** with the file Claude made (copy
   `private/istqb-progress.json` to your phone: email it to yourself, or put it in the private backup repo and
   download it).
2. Check the ISTQB home shows 2/6 chapters and the next session at Chapter 3.
3. Do your next commute session in TheHub. Use **Ask Claude** for questions and **Feedback** for anything off.
4. Stop using the Claude Project for sessions (keep it as an archive). Mark the Notion state database as archived.
5. Every week or two, run the content loop from `docs/content-loop.md`.

## What you have at the end of this part

Your ISTQB course inside TheHub, continuing from your real progress, with Chapters 3–6 taught, full mocks, a
readiness gate, and a written routine that turns your feedback into better content at no extra cost.
