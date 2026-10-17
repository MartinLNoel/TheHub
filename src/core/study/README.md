# The study engine (`src/core/study/`)

Shared by every study module (ISTQB in Part 6, Bulgarian in Part 7). A module is a few lines of config plus its
content; it never forks the engine. Data shapes are in `docs/plans/part-0-overview.md` ("Study engine data").

## Making a module

```js
// src/modules/istqb/index.js
import { createStudyModule } from '../../core/study/index.js';

export default createStudyModule({
  id: 'istqb', name: 'ISTQB', icon: '🧪',
  contentBase: 'content/istqb/',            // lessons.json, questions.json, cards.json (add them to PRECACHE)
  contentManifest: 'index.json',            // optional: { lessons: [files], questions: [files], cards: [files] }
  session: { drillSize: 4, quizSize: 5, retrievalCount: 2, passMark: 65 },
  mocks: [
    { id: 'full', label: 'Full mock', kind: 'full-mock', minutes: 60,
      perChapter: { 1: 8, 2: 6, 3: 4, 4: 11, 5: 9, 6: 2 } },
    { id: 'mini-3', label: 'Chapter 3 mini-mock', kind: 'mini-mock', minutes: 15, perChapter: { 3: 8 }, count: 10 },
  ],
  cards: { newPerDay: 10 },
  // Optional:
  schemaVersion: 1, migrations: {},          // the module's own data versions
  extendDefault: (d) => ({ ...d, readiness: [] }),   // module-only fields in the progress
  validateExtra: (d) => (Array.isArray(d.readiness) ? [] : ['readiness must be a list']),
  extraCards: (d) => d.offeredCards || [],   // cards held in the progress (Part 7's "From my home" deck)
  handledFeedback: () => HANDLED_IDS,        // ids from content/<course>/handled-feedback.json (content loop)
  routes: { readiness: renderReadiness },    // extra screens; same key replaces an engine screen
  todayCard: (data, course) => ({ ... }),    // replaces the default card; course is null while loading
  adjustSession: (session, course, data) => session,  // change a new session before it starts (ISTQB warm-up)
  homeCards: async (ctx, course, data) => node,       // extra card(s) at the top of the course home
});
```

Then list it in `src/modules.js`. The returned object is a normal module (`checkModule` passes) with
`study: true` and `getCourse()` (a promise of `{ course, problems }`).

## Screens it provides

`#/<id>` home (start/resume session, mocks in progress, mastery summary) · `session` · `lessons` ·
`lesson/<lessonId>` · `mock` · `cards` · `feedback`. Each lesson, answered question and card has **💬 Ask Claude**
and **📝 Feedback**. Route functions get `{ root, data, readOnly, save, navigate, settings, params }`.

## Content (`content/<course>/*.json`)

- lesson `{ id, chapter, section, title, objectives: [code], body }`: `body` is the markdown subset of
  `markdown.js` (headings, paragraphs, lists, **bold**, *italic*, `code`, simple tables). Order in the file is the
  course order; the session pointer walks it.
- question `{ id, objective, kLevel: K1|K2|K3, stem, options: [4], answer: A–D, why, distractorNotes: { each wrong
  letter }, source, chapter?, difficulty? 1–3 }`. A question whose objective is in no lesson must carry `chapter`
  (ISTQB Ch1–2). K-levels shown on lesson chips come from the questions.
- card `{ id, front, back, topic, twoWay, lang?: { front: 'bg', back: 'en' }, objective? }`. `twoWay` schedules
  each direction separately (`<id>` and `<id>~rev`); `lang` sets the text's language (Cyrillic shaping, speech).

`tests/unit/study-content.test.js` validates every course under `content/` (bad content fails CI); at runtime the
loader drops bad items and lists them on the home screen.

## Rules (pure functions, unit-tested)

| What | Where | Rule |
|---|---|---|
| Session | `session.js` `buildSession` | drill (due review items) → lesson (pointer) → quiz on its objectives → 1–2 delayed-retrieval questions from lessons ≥ 2 sessions back → debrief |
| Picking | `session.js` `priority` | past wrong +3 (+1 if the last try was wrong), shaky objective +2, unseen/untested +1, correct twice −5, exam-ready −1; last calibration nudges by `difficulty` |
| Debrief | `session.js` `finishSession` | binary score of quiz + retrieval; pointer moves on only if the quiz is finished and ≥ `passMark` (else re-teach) |
| Review | `progress.js` `updateReviewQueue` | wrong → due next session; correct when due → +3, then +7; leaves after 2 correct in a row; a miss starts again at +1 |
| Mastery | `progress.js` `nextMastery` | all correct → solid (→ exam-ready if also correct in an earlier session); ≥ half → untested becomes shaky, exam-ready drops to solid; < half → shaky |
| Calibration | `progress.js` `calibrate` | < 65 % slow · 65–85 % on pace · > 85 % accelerate |
| Mocks | `mock.js` | per-chapter counts (filled from other chapters if short, reported), freshest questions first, timer from `startedAt`/`endsAt` timestamps, unanswered = wrong |
| Cards | `scheduler.js` | SM-2 with again/hard/good/easy; local dates; `newPerDay` new sides a day |

Answers are recorded (attempts + review queue) the moment they are submitted; the session or mock in progress is
in the data (`activeSession`, `activeMock`), so stopping, closing the app or a reload never loses work.

## Ask Claude (`ask-claude.js`)

`buildAskMessage(course, target)` → text ending in `My question: `. `deliver(text, 'share' | 'link' | 'copy')`.
The choice is Settings → Ask Claude (default share sheet; "Copy instead" always offered). Which delivery works on
Martin's phone is open: `docs/QUESTIONS.md` Q-13.

## For Part 6 (ISTQB) and Part 7 (Bulgarian)

- Imported progress fits the shapes as they are: `mastery` for all 64 LOs, `reviewQueue` items may name only an
  `objective` (the drill picks a question for it) or carry only a `note` (kept, not drilled), `attempts` may hold `legacyText`, `sessions`
  with `section` = a lesson id let delayed retrieval reach back into imported history; `pointer` = the next lesson id.
- The readiness gate, 10-day warm-up and chapter-complete logic are module rules on top of `sessions` (kinds
  `lesson`, `mini-mock`, `full-mock`): ISTQB's are in `src/modules/istqb/rules.js`, wired through
  `adjustSession`, `homeCards`, `routes` and `todayCard`. Extra `routes` get only the screen context (not the
  engine's `env`); pass the module itself in if the screen needs `getCourse()`.
- A step may carry `label` (shown instead of its type) and imported sessions may list `objectives` for delayed
  retrieval (Part 6).
- Bulgarian: cards with `twoWay: true` and `lang`; offered words go in the progress and reach the engine through
  `extraCards`.
