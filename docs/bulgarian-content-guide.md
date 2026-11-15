# Bulgarian content guide

How the Bulgarian course content is written: the rules, the file layout, and what the run with the course book
must do. Read this before writing any Bulgarian content. The ISTQB equivalent is `docs/istqb-content-guide.md`.

## The rules (copyright and accuracy)

- **The course book is the canonical source** (the Bulgarian project's spec,
  `C:\Users\marti\Documents\Education\Bulgarian\SPEC.md`): lessons, vocabulary and exercises follow the book. The
  book itself stays in that private folder, **never in TheHub** (the repo is public).
- **Write everything in your own words.** Explanations of grammar and sounds are ours.
- **Follow the book's order and vocabulary**: chapter N in the app teaches what chapter N of the book teaches, with
  the book's words, in the book's order.
- **Never copy the book's texts, exercises or dialogues** into the repo, not even reworded line by line. Write new
  example sentences and new questions that use the chapter's words and grammar.
- **Single-word vocabulary lists are fine**: a word with its translation (and gender, plural, aspect partner where
  the book gives them) is a fact, not the book's text.
- **Martin checks chapter 1 before more is written.** Write chapter 1, ship it, and stop until he has studied it
  and said the style is right.
- **Double-check every Bulgarian word**: spelling (Cyrillic code points, never Latin look-alikes such as A or E),
  meaning, and the Latin form. The unit tests catch look-alikes and Latin forms that do not match the letters;
  meanings and stress are checked by you (and by Ask Claude when unsure). Say "unverified" in the commit if a word
  could not be checked.

## What exists before the book (2026-10-18)

Independent of the book, in our own words, and not pretending to follow it:

| File | Holds | Checked by |
|---|---|---|
| `content/bulgarian/index.json` | the manifest: `chapters` (book chapters written so far), `lessons`, `questions`, `cards` (file lists in book order), `alphabet`, `reading` (trainer files); all course lists are **empty** until the book | `tests/unit/bulgarian.test.js`, `study-content.test.js` |
| `content/bulgarian/alphabet.json` | `notes` and the 30 `letters`: `{ id, upper, lower, latin, sound, approx, example: { bg, latin, en }, russian? }` | 30 letters by code point, in order; unique sounds; example Latin forms |
| `content/bulgarian/reading.json` | 42 short everyday words for reading practice: `{ id, bg, latin, en, topic, note? }` (greetings, courtesy, numbers 1–10, food and drink, people, places) | only Bulgarian letters; `latin` must be what the letters spell |

The Latin forms use the app's letter-by-letter spelling (the alphabet's `latin` field): the official Bulgarian
system, except Ъ = "ă" (official "a") so it is not confused with А. The reading words are **not** flashcards: the
spec wants vocabulary from the book (Q-23 asks Martin whether he wants them as cards anyway).

## The book run: what it still has to do

1. **Course map first.** Read the book's table of contents and agree the chapter list with Martin (what each
   chapter teaches). Record it in `index.json` `chapters`: `[{ "chapter": 1, "title": "…", "files": { … } }]`
   (titles in your own words). Then write chapter 1 only.
2. **Per chapter**, files named by chapter, listed in `index.json` in book order:
   - `lessons-ch<N>.json`: engine lessons (`src/core/study/README.md`): `{ id: "bg<N>.<k>", chapter: N, section:
     "<N>.<k>", title, objectives: ["BG-<N>.<k>"], body }`. Objectives are our own codes (`BG-1.1` …), one per thing
     the chapter teaches (a grammar point, a group of words).
   - `cards-ch<N>.json`: the chapter's vocabulary as two-way cards `{ id: "ch<N>-<word>", front: <bg>, back: <en>,
     topic: "ch<N> <topic>", twoWay: true, lang: { front: "bg", back: "en" } }`. Ids must not contain `~`.
   - `questions-ch<N>.json`: the chapter quiz, engine questions (4 options, `why`, a note per wrong option,
     `source: "generated"`), written by us, never the book's exercises.
3. **The module UI for lessons** (*done 2026-11-15, version 0.9.6:* the Lessons tab and the session card appear
   by themselves once `index.json` lists lessons; still to do with the content: chapter progress, "next lesson" on
   the Today card, chapter quizzes): the Bulgarian home now shows a "Lessons start when your course book is added"
   panel instead of lessons (it disappears once lessons exist). Add the session card and chapter progress (the
   engine's session, or a Bulgarian variant), the Lessons tab, and "next lesson" on the Today card
   (`src/modules/bulgarian/index.js`, `screens.js`). Add chapter quizzes as engine `mocks` (one per chapter) if
   the book's chapters suit them.
4. **Duplicates with the home deck**: the Fridge may already have added a word (deck "home", id `home-<n>`). Keep
   the book's card too (it carries the chapter topic); `accept` already declines new home words that a course card
   has. Do not delete home cards: they hold Martin's review history.
5. **Tests**: extend `tests/unit/bulgarian.test.js` (every card's `front` passes the Bulgarian-letters check;
   chapter files listed in order; ids unique) and add an e2e for one lesson.
6. Bump the version, update `docs/CHANGELOG.md`, `docs/BACKLOG.md`, `docs/plans/part-7-bulgarian.md`, and commit
   per chapter (`content/bulgarian-ch<N>`).

## House style

- Short paragraphs; one idea per lesson section; English explanations, Bulgarian examples marked with their Latin
  form the first time a word appears.
- Point out where Bulgarian differs from Russian when Martin could be misled (as the alphabet's `russian` notes do).
- Mark stress only when you are sure of it.
- No personal data (Martin's answers, notes) in content files or commits.
