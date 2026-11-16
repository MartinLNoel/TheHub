// Recipes for the Fridge, added by a Claude instance through a link (Martin, 2026-11-16: "as simple as copy and
// paste a link, or nothing"). The format and how to make a link: docs/recipe-links.md.
//
// A link: https://martinlnoel.github.io/TheHub/#/fridge/recipe-import/<payload>
// payload: the recipe as JSON, UTF-8, in base64url (no padding). Tapping it opens the import screen (a preview,
// then one tap saves). The Recipes screen also takes the link (or the JSON itself) pasted into a box.
import { localDate } from '../../core/dates.js';
import { amount, newFoodId, NUTRIENTS } from './food.js';

export const APP_URL = 'https://martinlnoel.github.io/TheHub/';
export const IMPORT_ROUTE = 'recipe-import';
export const LIMITS = { name: 120, servings: 50, ingredients: 60, steps: 40, line: 400, notes: 2000 };

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** base64url of UTF-8 text (no padding). */
export function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(payload) {
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** The import link for a recipe (the fields of the format; ids and dates are left out). */
export function recipeLink(recipe, base = APP_URL) {
  const { name, servings, ingredients, steps, perServing, notes } = recipe;
  const body = { thehub: 'recipe', v: 1, name, servings, ingredients, steps, perServing, ...(notes ? { notes } : {}) };
  return `${base}#/fridge/${IMPORT_ROUTE}/${toBase64Url(JSON.stringify(body))}`;
}

/**
 * Reads what Martin pasted or what a link carried: a whole link, the part after "recipe-import/", or the JSON.
 * Returns { ok: true, recipe } (checked, not yet saved) or { ok: false, problems }.
 */
export function readRecipe(input) {
  let text = String(input ?? '').trim();
  if (!text) return { ok: false, problems: ['Nothing was pasted.'] };
  const marker = `${IMPORT_ROUTE}/`;
  const at = text.indexOf(marker);
  if (at >= 0) text = text.slice(at + marker.length).trim();
  let json;
  if (text.startsWith('{')) json = text;
  else if (/^%7B/i.test(text)) {
    try {
      json = decodeURIComponent(text);
    } catch {
      return { ok: false, problems: ['The link is damaged (it could not be decoded).'] };
    }
  } else {
    try {
      json = fromBase64Url(text.replace(/[?#].*$/, ''));
    } catch {
      return { ok: false, problems: ['This is not a TheHub recipe link (or it was cut off).'] };
    }
  }
  let body;
  try {
    body = JSON.parse(json);
  } catch {
    return { ok: false, problems: ['The recipe inside the link is not readable (it may have been cut off).'] };
  }
  return checkRecipe(body);
}

const lines = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : null);

/** Checks the format's fields and returns { ok, recipe } or { ok: false, problems }. */
export function checkRecipe(body) {
  if (!isObject(body)) return { ok: false, problems: ['The recipe is not an object.'] };
  const problems = [];
  if (body.thehub !== undefined && body.thehub !== 'recipe') problems.push('This is not a recipe ("thehub" should be "recipe").');
  if (body.v !== undefined && body.v !== 1) problems.push(`This recipe uses format version ${body.v}; this app reads version 1. Update TheHub.`);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) problems.push('The recipe has no name.');
  else if (name.length > LIMITS.name) problems.push(`The name is longer than ${LIMITS.name} characters.`);
  const servings = Number(body.servings ?? 1);
  if (!Number.isInteger(servings) || servings < 1 || servings > LIMITS.servings) problems.push(`Servings must be a whole number from 1 to ${LIMITS.servings}.`);
  const ingredients = lines(body.ingredients);
  const steps = lines(body.steps ?? []);
  if (!ingredients || ingredients.some((x) => typeof x !== 'string')) problems.push('Ingredients must be a list of text.');
  if (!steps || steps.some((x) => typeof x !== 'string')) problems.push('Steps must be a list of text.');
  const clean = (list) => (list || []).map((x) => String(x).trim()).filter(Boolean);
  const ing = clean(ingredients);
  const st = clean(steps);
  if (ingredients && !ing.length) problems.push('The recipe has no ingredients.');
  if (ing.length > LIMITS.ingredients) problems.push(`More than ${LIMITS.ingredients} ingredients.`);
  if (st.length > LIMITS.steps) problems.push(`More than ${LIMITS.steps} steps.`);
  if ([...ing, ...st].some((x) => x.length > LIMITS.line)) problems.push(`A line is longer than ${LIMITS.line} characters.`);
  const per = isObject(body.perServing) ? body.perServing : null;
  const perServing = Object.fromEntries(NUTRIENTS.map((k) => [k, amount(per?.[k])]));
  if (!per) problems.push('The recipe has no "perServing" nutrition.');
  else {
    for (const k of NUTRIENTS) if (per[k] !== undefined && per[k] !== null && perServing[k] === null) problems.push(`perServing.${k} must be a number of 0 or more.`);
    if (perServing.kcal === null || perServing.protein === null) problems.push('perServing needs at least kcal and protein.');
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > LIMITS.notes) problems.push(`The notes are longer than ${LIMITS.notes} characters.`);
  if (problems.length) return { ok: false, problems };
  return { ok: true, recipe: { name, servings, ingredients: ing, steps: st, perServing, notes } };
}

/** The recipe with the same name (any case), or undefined. */
export function sameName(data, name) {
  const key = name.trim().toLowerCase();
  return data.food.recipes.find((r) => r.name.trim().toLowerCase() === key);
}

/** Saves a checked recipe; one with the same name is replaced (keeping its id). Returns { data, recipe, replaced }. */
export function saveRecipe(data, recipe, now = new Date()) {
  const food = structuredClone(data.food);
  const old = sameName(data, recipe.name);
  const saved = { id: old?.id || newFoodId('r', new Date(now).getTime()), ...structuredClone(recipe), added: localDate(now) };
  food.recipes = old ? food.recipes.map((r) => (r.id === old.id ? saved : r)) : [...food.recipes, saved];
  return { data: { ...data, food }, recipe: saved, replaced: Boolean(old) };
}

export function deleteRecipe(data, id) {
  const food = structuredClone(data.food);
  food.recipes = food.recipes.filter((r) => r.id !== id);
  return { ...data, food };
}

/** Nutrition for `count` servings of a recipe. */
export function servingsOf(recipe, count = 1) {
  const n = Number(count) > 0 ? Number(count) : 1;
  return Object.fromEntries(NUTRIENTS.map((k) => [k, recipe.perServing[k] === null ? null : Math.round(recipe.perServing[k] * n * 10) / 10]));
}
