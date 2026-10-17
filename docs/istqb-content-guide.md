# ISTQB content guide (house style for the content runs)

How lessons, questions and flashcards for the ISTQB module are written. Read it before any content run
(Part 6 Step 3, and the content loop in `docs/content-loop.md`). It distils the tutor prompt
(`C:\Users\marti\Documents\Education\AI Study Programs\ISTQB_CTFL_Testing_Foundation\CTFL_v4_tutor_prompt.md`),
the Exam Style Guide and the Legacy Analysis (both in Martin's Notion; a private summary with Martin's own trap
log is in `private/istqb-notes.md`, git-ignored, made on 2026-10-17 — if it is missing, read the Notion pages
again, read-only).

The worked example of everything below is **§3.1**: `content/istqb/lessons-ch3.json` (lesson `3.1`) and its nine
questions in `content/istqb/questions-ch3.json`.

## Copyright rules (the repo is public)

- **Write everything in your own words.** No sentence copied from the syllabus or any ISTQB document; no
  syllabus quote longer than a term or a short phrase that *is* the term (e.g. "impact analysis").
- **Never include official ISTQB sample-exam questions or their answers**, reworded or not, and never the
  official question numbers with answers. Martin keeps the sample exams as private PDFs; the Official Question
  Pool Index (Notion) lists them by LO without answers, for homework only.
- Every question is `"source": "generated"`: written fresh for TheHub.
- Objective titles (`objectives.json`) are short descriptions in our own words, not the syllabus wording.

## File layout (`content/istqb/`)

| File | What | Who edits it |
|---|---|---|
| `index.json` | the manifest: which files hold lessons, questions and cards, in course order | only when a file is added |
| `objectives.json` | all 64 LOs: `code`, `chapter`, `section`, `kLevel`, short `title` (14 K1 · 42 K2 · 8 K3) | fixed |
| `lessons-ch3.json` … `lessons-ch6.json` | the lessons, one per syllabus section (`id` = `section`, e.g. `"4.2"`) in course order | the run for that chapter |
| `questions-ch1.json` … `questions-ch6.json` | the question bank, one file per chapter | the run for that chapter |
| `cards.json` | flashcards: terminology drill list and mnemonics | any run (add, do not reorder) |
| `handled-feedback.json` | ids of Martin's feedback notes a content update has handled (the app shows them resolved) | the content loop |

**No lessons for Chapters 1–2** (Martin studied them in the Claude Project); their questions exist only for
mocks, warm-ups and reviews. Every new file must also go into `index.json` and into `PRECACHE` in `sw.js`, and the
app version must be bumped in `src/version.js` and `sw.js` (CLAUDE.md, Commands). The tests check all of it.

## Lessons

Shape: `{ "id": "3.2", "chapter": 3, "section": "3.2", "title": "…", "objectives": ["FL-3.2.1", …], "body": "…" }`.
One lesson per section is the default; a long section (4.2, 5.1) may be split into `4.2a`, `4.2b` with
`section` `"4.2"`, each about one 40-minute session (15–20 minutes of reading).

The body is the engine's markdown subset (`src/core/study/markdown.js`): `#` headings, paragraphs, `-` and `1.`
lists, `**bold**`, `*italic*`, `` `code` ``, simple tables. Nothing else renders.

- **Mobile first:** short paragraphs, a heading every few paragraphs, lists over prose, at most a tiny table
  (no wide tables), no long code.
- **One heading per LO**, written as `# FL-3.1.2 (K2): what it is about`, so Martin always sees the LO code and
  the exam depth (K1 = recall the list, K2 = explain/compare/classify, K3 = apply/compute).
- **Unity/game-QA examples throughout**: GDDs, C# scripts, Animator state machines, stat ranges, save systems,
  console certification, playtests, patches. EP/BVA ↔ stat ranges; state transition ↔ game states;
  severity/priority ↔ crash vs store-page typo.
- **Exact ISTQB terms**, bold on first use. Wherever a close-but-informal phrasing exists, flag it:
  `**Exam trap:** "…". Wrong: …` (informal paraphrase vs exam term is Martin's #1 failure mode).
- End with `# Unity connections` (2–4 bullets) and, where useful, a short side note linking to a later chapter.
- **Verify every worked example by working it through before writing it**: boundary values, partitions,
  decision-table columns, state-transition sequences and coverage percentages. Write the working into the lesson
  (e.g. list the partitions and the values), so Martin can check it too.
- Mnemonics (2-3-2, PMADIEC, CIRAP, I-WTI, 3 C's, INVEST, Given/When/Then) may be taught in lessons.

### Emphasis (from the Legacy Analysis)

**Extra drilling** (more explanation, more questions, the harder distractors): Ch1 §1.4–1.5 terms (testware map,
impact analysis, XP, confirmation bias, error–defect–failure and root cause, Design vs Implementation); **EP**
(spec-based valid/invalid partitions, three partitions for a range with invalid on both ends, EP vs BVA);
**experience-based technique names** (error guessing and fault attacks, exploratory = learning-driven with
simultaneous design/execution/evaluation, checklist-based); **severity vs priority**; **Ch6** (static testing
tool category = reviews and static analysis; exact benefit/risk wording); **acceptance vs system testing actors**;
**review types and roles** (walkthrough author-led; inspection most formal; the author never leads or scribes);
functional (WHAT) vs non-functional (HOW WELL).

**Standard depth, harder distractors** (proven strong): decision tables, state transitions, white-box statement
and branch coverage, Ch5 planning, estimation and risk, collaboration-based approaches. Re-verify the testing
quadrants (needed extra explanation before).

## Questions

Shape (engine validator, `src/core/study/content.js`):

```json
{ "id": "q4.2.1-c", "objective": "FL-4.2.1", "kLevel": "K3", "chapter": 4, "difficulty": 2,
  "stem": "…", "options": ["…", "…", "…", "…"], "answer": "B", "why": "…",
  "distractorNotes": { "A": "…", "C": "…", "D": "…" }, "source": "generated" }
```

- `id`: `q<LO without FL->-<letter>` (`q3.1.2-a`, `q3.1.2-b`, …). Never reuse or rename an id: Martin's history
  points at it. To retire a question, fix it in place.
- `kLevel` must equal the objective's K-level in `objectives.json`; **always set `chapter`** (Ch1–2 questions have
  no lesson, and it keeps mocks right while lessons are still missing); the question goes in that chapter's file.
- `difficulty`: 1 foundational, 2 exam level (default), 3 hard. The engine serves easier ones after a weak
  session and harder ones after a strong one.
- **How many:** at least **6 per objective**, **8 for K3** and for the "extra drilling" objectives above. Each
  question for the same LO uses a **different, novel scenario** (standing rule SR-1), different from the lesson's
  own examples: never ask something answered word for word in the lesson text.
- **Exam format only:** four options, exactly one correct, the app adds "Select ONE option.". Options similar in
  length and form; no "all of the above" / "none of the above"; the correct letter spread evenly over A–D.
- **Stem patterns:** K1 list recall ("Which of the following is a benefit of …?"); CORRECT/NOT statements with the
  negation in capitals; K2 scenario → classify (level, type, technique, review type, activity, risk); K2
  "You are a tester on a team that …"; K3 compute (minimum number of tests, coverage %, boundary values, which
  tests cover which partitions or transitions); matching written as "1-c, 2-a, 3-d, 4-b"; K3 defect report
  (best report, missing field).
- **Never name a mnemonic in a stem** (standing rule SR-2; a unit test checks it).
- **Distractors** are built from the official patterns, seeded from Martin's mistakes: adjacent-concept swap,
  informal paraphrase next to the exact term, off-by-one boundary or partition count, wrong actor, category smear,
  overgeneralisation ("always", "all", "proves", "exhaustive"), true-but-irrelevant.
- `why` explains why the key is right; `distractorNotes` explains why **each** wrong option is wrong (and names
  the trap); nothing explains the correct option there. The app shows none of it before Martin answers.
- K3 questions: work the answer out fully and check that no distractor is also defensible. Use small, exact
  numbers.

## Flashcards (`cards.json`)

`{ "id": "t-<term>" | "m-<mnemonic>", "front": "…", "back": "…", "topic": "Terminology" | "Mnemonics",
"twoWay": false, "objective": "FL-…" }`. Terminology cards ask for the exact term from a description (the front
never gives the term away); mnemonic cards ask for the list ("The seven test activities, in order") and put the
mnemonic on the back.

## Checks before committing a content run

1. `npm test` (content validation, K-levels, chapters, mnemonic ban, precache, version).
2. When a chapter is finished, add it to `FINISHED_CHAPTERS` in `tests/unit/istqb.test.js` (it then enforces 6
   per objective, 8 for K3). After the last run, remove the `.skip` from the whole-bank test.
3. `npm run e2e`.
4. Read each new lesson once at phone width (`npm run serve`).
5. Bump the version, update `docs/BACKLOG.md` and `docs/CHANGELOG.md`, commit per chapter.
