// Flashcard scheduler: SM-2 (SuperMemo 2, Wozniak 1987), simplified to four buttons.
//
// Each card side has a state { reps, interval, ef, due, lapses }:
//   reps      correct reviews in a row
//   interval  days until the next review
//   ef        ease factor, starts at 2.5, never below 1.3
//   due       local date "YYYY-MM-DD" of the next review
//   lapses    how often it was forgotten
//
// Grades: again (q=1), hard (q=3), good (q=4), easy (q=5).
//   again: reps = 0, interval = 0 (shown again in this run, due today), lapses + 1, ef drops.
//   else:  reps 0 -> 1 day, reps 1 -> 6 days (hard: 3), then interval × ef (hard: × 1.2, easy: × ef × 1.3).
//   ef' = ef + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02)), at least 1.3.
//
// Two-way cards are scheduled per direction: key "<id>" is front -> back, "<id>~rev" is back -> front.

import { addDays, localDate } from '../dates.js';

export const GRADES = { again: 1, hard: 3, good: 4, easy: 5 };
export const MIN_EF = 1.3;
export const START_EF = 2.5;

// Today's local date as "YYYY-MM-DD" (local, not UTC: a review at 00:30 belongs to that day); the
// helpers live in src/core/dates.js and are re-exported here for the engine's callers.
export { addDays, localDate };

export function newCardState(today) {
  return { reps: 0, interval: 0, ef: START_EF, due: today, lapses: 0 };
}

/** The next state of a card side after a grade. Pure. */
export function schedule(state, grade, today) {
  const q = GRADES[grade];
  if (!q) throw new Error(`unknown grade "${grade}"`);
  const s = state ? { ...state } : newCardState(today);
  const ef = Math.max(MIN_EF, s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (q < 3) {
    return { reps: 0, interval: 0, ef: Math.round(ef * 100) / 100, due: today, lapses: s.lapses + 1, last: today };
  }
  let interval;
  if (s.reps === 0) interval = grade === 'easy' ? 4 : 1;
  else if (s.reps === 1) interval = grade === 'hard' ? 3 : 6;
  else {
    const factor = grade === 'hard' ? 1.2 : grade === 'easy' ? s.ef * 1.3 : s.ef;
    interval = Math.max(s.interval + 1, Math.round(s.interval * factor));
  }
  return { reps: s.reps + 1, interval, ef: Math.round(ef * 100) / 100, due: addDays(today, interval), lapses: s.lapses, last: today };
}

/** Every reviewable side of the cards: [{ key, card, reverse }]. */
export function cardSides(cards) {
  return cards.flatMap((card) => [
    { key: card.id, card, reverse: false },
    ...(card.twoWay ? [{ key: `${card.id}~rev`, card, reverse: true }] : []),
  ]);
}

/**
 * The sides to review today: due ones (oldest due first), then up to `newPerDay` new ones in content
 * order. `cardState` is { [key]: state }. Sides introduced today count towards the new limit.
 */
export function dueSides(cards, cardState = {}, today, { newPerDay = 10 } = {}) {
  const sides = cardSides(cards);
  const due = sides
    .filter((s) => cardState[s.key] && cardState[s.key].due <= today)
    .sort((a, b) => (cardState[a.key].due < cardState[b.key].due ? -1 : cardState[a.key].due > cardState[b.key].due ? 1 : 0));
  const introducedToday = Object.values(cardState).filter((st) => st.first === today).length;
  const fresh = sides.filter((s) => !cardState[s.key]).slice(0, Math.max(0, newPerDay - introducedToday));
  return [...due, ...fresh];
}

/** Records a grade for one side into a copy of cardState. */
export function gradeSide(cardState = {}, key, grade, today) {
  const prev = cardState[key];
  const next = schedule(prev, grade, today);
  next.first = prev?.first ?? today;
  return { ...cardState, [key]: next };
}
