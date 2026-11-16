// The Fridge's food log, quick foods, recipes and calorie target (Fridge schema 2, version 0.9.8).
//
// Martin, 2026-11-16: protein and calorie tracking moves from the Gym to the Fridge, calories are tracked from
// now on, and recipes are added by a Claude instance through a link (docs/recipe-links.md), never typed.
//
//   food.log        { "YYYY-MM-DD" (local date): [{ id, name, protein, kcal, carbs, fat, from }] }
//                   protein/kcal/carbs/fat: a number of 0 or more, or null when unknown (the Gym's old log
//                   knew only protein). from: 'quick' | 'item' | 'recipe' | 'manual' | 'gym'
//   food.myFoods    [{ id, name, protein, kcal, carbs, fat }]   one-tap foods (the Gym's quick foods moved here)
//   food.recipes    [{ id, name, servings, ingredients: [text], steps: [text], perServing: { protein, kcal,
//                     carbs, fat }, notes, added: "YYYY-MM-DD" }]
//   food.kcalTarget kcal a day, or null until Martin picks one (Q-27: the app suggests one from his weight)
//   food.kcalSince  "YYYY-MM-DD" the target was first set: the first LEARNING_DAYS days show no verdicts
//   food.gymMoved   ids of the Gym's old protein entries and foods already taken over (so a deleted one stays
//                   deleted and nothing is taken twice)
import { isCalendarDate, localDate, daysBetween } from '../../core/dates.js';

export const NUTRIENTS = ['protein', 'kcal', 'carbs', 'fat'];
export const LEARNING_DAYS = 14;
export const FROM = ['quick', 'item', 'recipe', 'manual', 'gym'];

/**
 * The Gym's quick foods, now with calories, carbs and fat. Estimates from common food tables (raw weights,
 * plain products); Martin can delete them or add his own.
 */
export const DEFAULT_MY_FOODS = [
  { id: 'd-chicken', name: 'Chicken breast 200g', protein: 46, kcal: 240, carbs: 0, fat: 4 },
  { id: 'd-eggs', name: '4 eggs', protein: 24, kcal: 290, carbs: 2, fat: 20 },
  { id: 'd-whey', name: 'Whey shake', protein: 25, kcal: 120, carbs: 3, fat: 2 },
  { id: 'd-yogurt', name: 'Greek yogurt 150g', protein: 15, kcal: 145, carbs: 6, fat: 8 },
  { id: 'd-beef', name: 'Ground beef 200g', protein: 40, kcal: 350, carbs: 0, fat: 24 },
  { id: 'd-tuna', name: 'Tuna can', protein: 30, kcal: 130, carbs: 0, fat: 1 },
  { id: 'd-cottage', name: 'Cottage cheese 200g', protein: 24, kcal: 200, carbs: 7, fat: 9 },
  { id: 'd-milk', name: 'Milk 250ml', protein: 8, kcal: 120, carbs: 12, fat: 4 },
];

export function defaultFood() {
  return { log: {}, myFoods: structuredClone(DEFAULT_MY_FOODS), recipes: [], kcalTarget: null, kcalSince: null, gymMoved: [] };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string';
const amountOk = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

let counter = 0;
export function newFoodId(prefix = 'f', now = Date.now()) {
  counter = (counter + 1) % 1e6;
  return `${prefix}${now.toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A number of 0 or more from a form value, rounded to 1 decimal; '' and nonsense become null. */
export function amount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
}

function nutritionProblems(where, n) {
  return NUTRIENTS.filter((k) => !amountOk(n?.[k])).map((k) => `${where}: ${k} must be a number of 0 or more, or empty`);
}

/** Problems with data.food; [] means complete (part of the Fridge's validate). */
export function validateFood(food) {
  if (!isObject(food)) return ['food is missing'];
  const problems = [];
  if (!isObject(food.log)) problems.push('food.log must be an object of days');
  else {
    for (const [day, entries] of Object.entries(food.log)) {
      if (!isCalendarDate(day)) problems.push(`food day "${day}" is not a date`);
      if (!Array.isArray(entries)) {
        problems.push(`food on ${day} must be a list`);
        continue;
      }
      entries.forEach((e, i) => {
        const where = `food on ${day}, entry ${i + 1}`;
        if (!isObject(e)) return problems.push(`${where} is not an entry`);
        if (!isText(e.id) || !e.id) problems.push(`${where} has no id`);
        if (!isText(e.name) || !e.name.trim()) problems.push(`${where} has no name`);
        if (!FROM.includes(e.from)) problems.push(`${where} has an unknown source "${e.from}"`);
        problems.push(...nutritionProblems(where, e));
      });
    }
  }
  if (!Array.isArray(food.myFoods)) problems.push('food.myFoods must be a list');
  else
    food.myFoods.forEach((f, i) => {
      const where = `my food ${i + 1}`;
      if (!isObject(f) || !isText(f.id) || !isText(f.name) || !f.name.trim()) return problems.push(`${where} needs an id and a name`);
      problems.push(...nutritionProblems(where, f));
    });
  if (!Array.isArray(food.recipes)) problems.push('food.recipes must be a list');
  else
    food.recipes.forEach((r, i) => {
      const where = `recipe ${i + 1}`;
      if (!isObject(r)) return problems.push(`${where} is not a recipe`);
      if (!isText(r.id) || !r.id) problems.push(`${where} has no id`);
      if (!isText(r.name) || !r.name.trim()) problems.push(`${where} has no name`);
      if (!Number.isInteger(r.servings) || r.servings < 1) problems.push(`${where}: servings must be a whole number of 1 or more`);
      if (!Array.isArray(r.ingredients) || r.ingredients.some((x) => !isText(x))) problems.push(`${where}: ingredients must be a list of text`);
      if (!Array.isArray(r.steps) || r.steps.some((x) => !isText(x))) problems.push(`${where}: steps must be a list of text`);
      if (!isObject(r.perServing)) problems.push(`${where} has no nutrition per serving`);
      else problems.push(...nutritionProblems(`${where} per serving`, r.perServing));
      if (!isText(r.notes)) problems.push(`${where}: notes must be text`);
      if (!isCalendarDate(r.added)) problems.push(`${where} has no valid added date`);
    });
  if (food.kcalTarget !== null && !(Number.isInteger(food.kcalTarget) && food.kcalTarget > 0)) problems.push('the calorie target must be a whole number above 0, or empty');
  if (food.kcalSince !== null && !isCalendarDate(food.kcalSince)) problems.push('kcalSince must be a date or empty');
  if (!Array.isArray(food.gymMoved) || food.gymMoved.some((x) => !isText(x))) problems.push('food.gymMoved must be a list of ids');
  return problems;
}

const withFood = (data, food) => ({ ...data, food });

/** The nutrition fields of anything, as numbers or null. */
export function nutritionOf(src) {
  return Object.fromEntries(NUTRIENTS.map((k) => [k, amount(src?.[k])]));
}

/** Logs food for today (local date). entry: { name, protein, kcal, carbs, fat, from }. Returns new data. */
export function logFood(data, entry, now = new Date()) {
  const day = localDate(now);
  const food = structuredClone(data.food);
  const item = { id: newFoodId('e', new Date(now).getTime()), name: String(entry.name || '').trim() || 'Food', ...nutritionOf(entry), from: FROM.includes(entry.from) ? entry.from : 'manual' };
  food.log[day] = [...(food.log[day] || []), item];
  return withFood(data, food);
}

export function removeFood(data, day, id) {
  const food = structuredClone(data.food);
  if (!food.log[day]) return data;
  food.log[day] = food.log[day].filter((e) => e.id !== id);
  if (!food.log[day].length) delete food.log[day];
  return withFood(data, food);
}

/** Sums a list of entries; unknown values count as 0, and `kcalUnknown` says how many had no kcal. */
export function totals(entries) {
  const sum = { protein: 0, kcal: 0, carbs: 0, fat: 0, kcalUnknown: 0 };
  for (const e of entries) {
    for (const k of NUTRIENTS) sum[k] += e[k] || 0;
    if (e.kcal === null) sum.kcalUnknown += 1;
  }
  for (const k of NUTRIENTS) sum[k] = Math.round(sum[k]);
  return sum;
}

/** A day's food (hub answer `foodDay`): { date, entries, totals }. date: "YYYY-MM-DD", default today. */
export function foodDay(data, date = localDate()) {
  const entries = data?.food?.log?.[date] || [];
  return { date, entries, totals: totals(entries) };
}

export function addMyFood(data, fields) {
  const food = structuredClone(data.food);
  food.myFoods.push({ id: newFoodId('m'), name: String(fields.name).trim(), ...nutritionOf(fields) });
  return withFood(data, food);
}

export function deleteMyFood(data, id) {
  const food = structuredClone(data.food);
  food.myFoods = food.myFoods.filter((f) => f.id !== id);
  return withFood(data, food);
}

/** Nutrition for `grams` of a product known per 100 g (Open Food Facts), or null when it is not known. */
export function portion(per100, grams) {
  const g = amount(grams);
  if (!per100 || !g) return null;
  const out = Object.fromEntries(NUTRIENTS.map((k) => [k, per100[k] === null || per100[k] === undefined ? null : Math.round(per100[k] * g / 10) / 10]));
  return out.kcal === null && out.protein === null ? null : out;
}

// ------------------------------------------------------------------------------------------ calorie target

/**
 * A starting calorie target from body weight (Q-27: Martin does not know his number): about 33 kcal per kg, a
 * common maintenance estimate for a moderately active adult, rounded to 50. Only a starting point.
 */
export function suggestKcal(bodyweight) {
  return bodyweight > 0 ? Math.round((bodyweight * 33) / 50) * 50 : null;
}

export function setKcalTarget(data, value, now = new Date()) {
  const n = Math.round(Number(value));
  const food = structuredClone(data.food);
  if (value === null || value === '' || !Number.isFinite(n) || n <= 0) {
    food.kcalTarget = null;
  } else {
    food.kcalTarget = n;
    food.kcalSince = food.kcalSince || localDate(now);
  }
  return withFood(data, food);
}

/** Day 1..LEARNING_DAYS of the first two weeks with a target (no verdicts yet), else null. */
export function learningDay(data, now = new Date()) {
  const since = data.food.kcalSince;
  if (!since || data.food.kcalTarget === null) return null;
  const day = daysBetween(since, localDate(now)) + 1;
  return day >= 1 && day <= LEARNING_DAYS ? day : null;
}

// ------------------------------------------------------------------------------------------ the Gym's old log

/**
 * Takes over the Gym's protein log and saved foods from before 0.9.8 (hub.ask('gym', 'foodArchive')):
 * { proteinLogs: { day: [{ name, grams }] }, myFoods: [{ name, protein }] }. Each old entry gets a stable id, so
 * running this again adds nothing and an entry Martin deleted here stays deleted. Returns new data, or null when
 * there is nothing new. The Gym keeps its own copy untouched (an archive in every backup).
 */
export function mergeGymArchive(data, archive) {
  if (!isObject(archive)) return null;
  const food = structuredClone(data.food);
  const moved = new Set(food.gymMoved);
  let added = 0;
  for (const [day, entries] of Object.entries(isObject(archive.proteinLogs) ? archive.proteinLogs : {})) {
    if (!isCalendarDate(day) || !Array.isArray(entries)) continue;
    entries.forEach((e, i) => {
      const id = `g-${day}-${i}`;
      if (moved.has(id) || !isObject(e)) return;
      moved.add(id);
      food.log[day] = [...(food.log[day] || []), { id, name: String(e.name || 'Protein').trim() || 'Protein', protein: amount(e.grams) ?? 0, kcal: null, carbs: null, fat: null, from: 'gym' }];
      added += 1;
    });
  }
  const names = new Set(food.myFoods.map((f) => f.name.toLowerCase()));
  for (const f of Array.isArray(archive.myFoods) ? archive.myFoods : []) {
    if (!isObject(f) || !isText(f.name) || !f.name.trim()) continue;
    const id = `gf-${f.name.trim().toLowerCase()}`;
    if (moved.has(id)) continue;
    moved.add(id);
    added += 1;
    if (names.has(f.name.trim().toLowerCase())) continue; // already a quick food here
    food.myFoods.push({ id, name: f.name.trim(), protein: amount(f.protein), kcal: null, carbs: null, fat: null });
  }
  if (!added) return null;
  food.gymMoved = [...moved];
  return withFood(data, food);
}
