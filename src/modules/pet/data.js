// The companion pet's data (schema 1, version 0.9.12). Martin, 2026-11-16: a simple tamagotchi on the home screen,
// tapped to interact, kept fed "without it feeling like a chore"; its look: "Surprise me".
//
// It is fed by what Martin already does: each workout, study session, day of Bulgarian practice and day of logged
// food is one meal (the modules answer hub.ask(id, 'activities')). It never gets sick, sad or dies: away for a
// while, it just naps or gets bored, and it is happy again with the next meal.
//
//   name      text (Martin can rename it)
//   born      "YYYY-MM-DD": only activities from this day on are meals (old history does not flood it)
//   eaten     [{ id, date }]   recent meals already eaten (pruned after KEEP_DAYS), so none is eaten twice
//   meals     how many meals in total;  byKind { workout, study, bulgarian, food }
//   lastMeal  "YYYY-MM-DD" | null;  taps: how many times it was tapped
import { addDays, daysBetween, isCalendarDate, localDate } from '../../core/dates.js';

export const SCHEMA_VERSION = 1;
export const KINDS = ['workout', 'study', 'bulgarian', 'food'];
export const KIND_LABEL = { workout: 'a workout', study: 'a study session', bulgarian: 'Bulgarian practice', food: 'your food log' };
/** Meals are looked for this many days back; eaten ids are kept a bit longer so none is eaten twice. */
export const LOOK_BACK_DAYS = 30;
export const KEEP_DAYS = 45;
/** Meals needed for each stage. */
export const STAGES = [
  { id: 'egg', name: 'Egg', from: 0 },
  { id: 'baby', name: 'Hatchling', from: 1 },
  { id: 'young', name: 'Sprout', from: 5 },
  { id: 'grown', name: 'Grown', from: 20 },
  { id: 'elder', name: 'In bloom', from: 50 },
];

export function defaultData(now = new Date()) {
  return { name: 'Pip', born: localDate(now), eaten: [], meals: 0, byKind: { workout: 0, study: 0, bulgarian: 0, food: 0 }, lastMeal: null, taps: 0 };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (n) => Number.isInteger(n) && n >= 0;

export function validate(d) {
  if (!isObject(d)) return ['the pet data is missing'];
  const p = [];
  if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 24) p.push('the pet needs a name of at most 24 characters');
  if (!isCalendarDate(d.born)) p.push('born must be a date');
  if (!Array.isArray(d.eaten) || d.eaten.some((e) => !isObject(e) || typeof e.id !== 'string' || !isCalendarDate(e.date))) p.push('eaten must be a list of { id, date }');
  if (!isCount(d.meals)) p.push('meals must be a whole number of 0 or more');
  if (!isObject(d.byKind) || KINDS.some((k) => !isCount(d.byKind[k]))) p.push('byKind must count every kind of meal');
  if (d.lastMeal !== null && !isCalendarDate(d.lastMeal)) p.push('lastMeal must be a date or empty');
  if (!isCount(d.taps)) p.push('taps must be a whole number of 0 or more');
  return p;
}

/** The activities that are new meals: from `born` on, at most LOOK_BACK_DAYS old, not eaten yet, oldest first. */
export function newMeals(data, activities, now = new Date()) {
  const today = localDate(now);
  const from = [data.born, addDays(today, -LOOK_BACK_DAYS)].sort().at(-1);
  const eaten = new Set(data.eaten.map((e) => e.id));
  const seen = new Set();
  return activities
    .filter((a) => a && typeof a.id === 'string' && KINDS.includes(a.kind) && isCalendarDate(a.date) && a.date >= from && a.date <= today && !eaten.has(a.id))
    .filter((a) => (seen.has(a.id) ? false : seen.add(a.id)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Eats the meals: counts them, remembers their ids, forgets ids older than KEEP_DAYS. Returns new data. */
export function eat(data, meals, now = new Date()) {
  if (!meals.length) return data;
  const cutoff = addDays(localDate(now), -KEEP_DAYS);
  const byKind = { ...data.byKind };
  for (const m of meals) byKind[m.kind] += 1;
  const last = meals.map((m) => m.date).sort().at(-1);
  return {
    ...data,
    eaten: [...data.eaten, ...meals.map((m) => ({ id: m.id, date: m.date }))].filter((e) => e.date >= cutoff),
    meals: data.meals + meals.length,
    byKind,
    lastMeal: data.lastMeal && data.lastMeal > last ? data.lastMeal : last,
  };
}

export function stageFor(meals) {
  return [...STAGES].reverse().find((s) => meals >= s.from);
}

export function nextStage(meals) {
  return STAGES.find((s) => s.from > meals) || null;
}

/**
 * Its mood: 'sleeping' at night (22:00–07:00), otherwise 'happy' when it ate today, 'content' within 2 days,
 * 'bored' after that (never sad), and 'waiting' as an egg.
 */
export function moodFor(data, now = new Date()) {
  const hour = now.getHours();
  if (hour >= 22 || hour < 7) return 'sleeping';
  if (data.meals === 0) return 'waiting';
  const days = data.lastMeal ? daysBetween(data.lastMeal, localDate(now)) : 99;
  if (days <= 0) return 'happy';
  if (days <= 2) return 'content';
  return 'bored';
}

export function rename(data, name) {
  const n = String(name ?? '').trim().slice(0, 24);
  return n ? { ...data, name: n } : data;
}

export const tapped = (data) => ({ ...data, taps: data.taps + 1 });
