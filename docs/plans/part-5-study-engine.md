# TheHub — Part 5: Shared Study Engine (lessons, questions, flashcards, Ask Claude, feedback)

**Depends on:** Part 4
**Branch:** `part-5/study-engine`
**Estimated effort:** 2–3 sessions

The engine that ISTQB (Part 6) and Bulgarian (Part 7) both use. It ships with a small **sample** content set only;
real content comes in Part 6.

---

## USER ACTIONS REQUIRED

None before starting. Have your phone nearby: one step tests "Ask Claude" on the real device.

---

## Instructions for Claude

> **IMPORTANT:** Start Claude Code from the project directory:
> `C:\Users\marti\Documents\Education\TheHub`
>
> Copy everything below this box and paste it as your prompt to Claude.

---

### Prompt Start

You are building **TheHub** (read `CLAUDE.md`, `SPEC.md`, `docs/plans/part-0-overview.md` — especially "Study engine
data" — then `docs/BACKLOG.md`). This is **Part 5: the shared study engine** in `src/core/study/`. It must serve two
very different courses: the ISTQB CTFL v4 exam course (multiple-choice, learning objectives with K-levels, timed
mocks) and later a Bulgarian beginner course (Cyrillic, two-way vocabulary cards). Read the ISTQB tutor prompt,
`C:\Users\marti\Documents\Education\AI Study Programs\ISTQB_CTFL_Testing_Foundation\CTFL_v4_tutor_prompt.md`: the
engine must make its rules possible (session format, binary scoring, 1/3/7 spaced review, mastery levels untested /
shaky / solid / exam-ready, difficulty calibration, never revealing an answer before an attempt).

Create branch `part-5/study-engine` from `main`.

**Build:**

1. **Content loader**: load and validate `content/<course>/lessons.json`, `questions.json`, `cards.json` (Part 0
   shapes). Bad content fails a unit test, never the app at runtime (CI validates every content file).
2. **Lesson reader**: mobile-first, a safe markdown subset (headings, paragraphs, lists, bold, simple tables), the
   learning-objective tags shown as chips.
3. **Question runner**: one question at a time, four options, "Select ONE option"; **no answer, hint or explanation
   shown before the answer is submitted**; then correct option, why, and why each distractor is wrong. Every attempt
   is recorded (`attempts`).
4. **Session builder**: given a course's progress, builds a session in the tutor prompt's format: a short drill from
   due review items, the next lesson (from `pointer`), a quiz picked from that lesson's objectives plus 1–2 delayed
   retrieval questions from at least two sessions back, then a debrief that updates `mastery`, `reviewQueue`,
   `sessions` and `pointer`. Questions already answered correctly twice are deprioritised; shaky objectives and past
   wrong answers are prioritised. A session can be stopped at any point and its progress is kept.
5. **Mock runner**: N questions with a time limit and given per-chapter counts, no feedback until the end, then a
   per-objective debrief. The timer survives the screen locking (based on timestamps, not intervals).
6. **Flashcards**: spaced repetition (a simple, documented SM-2-style scheduler), two-way cards, full Unicode,
   large text. Card text must render Cyrillic correctly (test it).
7. **Ask Claude**: a button on every lesson, question (after answering) and card. It builds a message with the
   course, section, objective, the question and options, Martin's answer and the correct one, and ends with
   "My question: " so he only types his question. Delivery, in this order of preference — **test each on Martin's
   phone and keep what works** (record the results in `docs/BACKLOG.md`):
   - a. **Android share sheet** (`navigator.share({ text })`): Martin picks the Claude app and the message lands in a
     new chat. Check whether Claude appears in the share list and whether the text arrives.
   - b. A **link that opens Claude with the message filled in**. On 2026-10-17 the only *documented* prefill links
     (support.claude.com article 14898120) open **Claude Code** sessions (`claude://code/new?q=…`,
     `https://claude.ai/code/new?q=…`) and need Claude Code access; they do not open a normal chat. A normal-chat
     prefill such as `https://claude.ai/new?q=…` is undocumented: try it, but do not rely on it unless it works on
     the phone.
   - c. Fallback: copy the message to the clipboard and open the Claude app, with a toast "Message copied — paste it".
   If the share sheet works, make it the default and offer "Copy instead" as a secondary action.
8. **Feedback**: a "Feedback" button on every lesson, question and card saves `{ targetId, text, at }` in the
   course's progress (and therefore in backups). A Feedback list screen per course shows open and resolved notes.
9. A **sample course** under `tests/fixtures/` (not shipped) to exercise everything.

**Tests (required):** unit: scheduler intervals; 1/3/7 review queue; mastery updates; session builder picks due
items and delayed retrieval; answer never present in the rendered DOM before submission; mock timer from timestamps;
content validation rejects bad files; Ask Claude message contains every context field. E2E: run a sample session end
to end; stop halfway and resume; a 5-question timed mock; leave feedback and see it in the list.

Update `docs/BACKLOG.md` and `docs/CHANGELOG.md`, bump the version, commit, push the branch.

### Prompt End

---

## USER ACTIONS after Claude finishes

1. Merge and deploy. On the phone, open the sample course from Settings (or the route Claude gives you).
2. Tap **Ask Claude** on a question and tell Claude which delivery worked (share sheet, link, or copy).
3. Leave one piece of feedback and check it appears in the Feedback list.

## What you have at the end of this part

A working study engine (lessons, adaptive sessions, timed mocks, flashcards, Ask Claude, feedback), tested on your
phone, ready for the ISTQB content.
