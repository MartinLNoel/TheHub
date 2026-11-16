// The Fridge's food log, recipes and calorie target (Fridge schema 2, 0.9.8): the logic, the migration, taking
// over the Gym's old protein log through the hub, hub.ask, and the screens. fetch is never reached.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fridge, { foodLine, onStart } from '../../src/modules/fridge/index.js';
import gym from '../../src/modules/gym/index.js';
import { defaultData as gymDefault } from '../../src/modules/gym/data.js';
import { SCHEMA_VERSION, cacheProduct, defaultData, migrations, validate, addItem } from '../../src/modules/fridge/data.js';
import {
  DEFAULT_MY_FOODS, LEARNING_DAYS, addMyFood, amount, deleteMyFood, foodDay, learningDay, logFood, mergeGymArchive, portion, removeFood, setKcalTarget, suggestKcal, totals,
} from '../../src/modules/fridge/food.js';
import { checkRecipe, deleteRecipe, fromBase64Url, readRecipe, recipeLink, saveRecipe, servingsOf, toBase64Url } from '../../src/modules/fridge/recipes.js';
import { mapNutrition, mapProduct } from '../../src/modules/fridge/off.js';
import { resetScreenState } from '../../src/modules/fridge/screens.js';
import { NO_HUB, createHub } from '../../src/core/hub.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';
import { runMigrations } from '../../src/core/db.js';
import { localDate } from '../../src/core/dates.js';

const NOW = new Date(2026, 10, 16, 12, 0); // 16 November 2026, noon local
const TODAY = localDate(NOW);
const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
const $ = (root, id) => root.querySelector(`[data-testid="${id}"]`);
const $$ = (root, id) => [...root.querySelectorAll(`[data-testid="${id}"]`)];

const RECIPE = {
  thehub: 'recipe',
  v: 1,
  name: 'Kip met rijst — één pan',
  servings: 2,
  ingredients: ['300 g chicken breast', '150 g rice', '1 paprika'],
  steps: ['Cook the rice.', 'Fry the chicken and paprika.', 'Mix.'],
  perServing: { kcal: 520, protein: 48, carbs: 60, fat: 8 },
  notes: 'Good for meal prep.',
};

describe('the food log', () => {
  it('logs food on the local day and sums it; unknown kcal counts as 0 and is reported', () => {
    let d = defaultData();
    d = logFood(d, { name: 'Whey shake', protein: 25, kcal: 120, carbs: 3, fat: 2, from: 'quick' }, NOW);
    d = logFood(d, { name: 'Old entry', protein: 20, kcal: null, from: 'gym' }, NOW);
    const day = foodDay(d, TODAY);
    expect(day.entries.map((e) => e.name)).toEqual(['Whey shake', 'Old entry']);
    expect(day.totals).toEqual({ protein: 45, kcal: 120, carbs: 3, fat: 2, kcalUnknown: 1 });
    expect(validate(d)).toEqual([]);
    const next = removeFood(d, TODAY, day.entries[0].id);
    expect(foodDay(next, TODAY).totals.protein).toBe(20);
    expect(foodDay(removeFood(next, TODAY, foodDay(next, TODAY).entries[0].id), TODAY).entries).toEqual([]);
    expect(removeFood(next, TODAY, foodDay(next, TODAY).entries[0].id).food.log[TODAY]).toBeUndefined();
  });

  it('reads form values as numbers of 0 or more (comma decimals too); nonsense becomes empty', () => {
    expect([amount('12,5'), amount('7'), amount(''), amount('-3'), amount('abc'), amount(null), amount(3.14159)]).toEqual([12.5, 7, null, null, null, null, 3.1]);
  });

  it('quick foods start with the Gym\'s eight, now with calories; add and delete', () => {
    const d = defaultData();
    expect(d.food.myFoods.map((f) => f.name)).toEqual(['Chicken breast 200g', '4 eggs', 'Whey shake', 'Greek yogurt 150g', 'Ground beef 200g', 'Tuna can', 'Cottage cheese 200g', 'Milk 250ml']);
    expect(d.food.myFoods.every((f) => f.kcal > 0)).toBe(true);
    const added = addMyFood(d, { name: ' Pork jerky ', protein: '18', kcal: '110' });
    const pork = added.food.myFoods.at(-1);
    expect(pork).toMatchObject({ name: 'Pork jerky', protein: 18, kcal: 110, carbs: null, fat: null });
    expect(validate(added)).toEqual([]);
    expect(deleteMyFood(added, pork.id).food.myFoods).toHaveLength(DEFAULT_MY_FOODS.length);
  });

  it('a portion of a product known per 100 g', () => {
    expect(portion({ protein: 10, kcal: 250, carbs: 30, fat: null }, 150)).toEqual({ protein: 15, kcal: 375, carbs: 45, fat: null });
    expect(portion({ protein: 10, kcal: 250 }, '')).toBeNull();
    expect(portion(null, 100)).toBeNull();
  });

  it('validate catches broken food data', () => {
    const d = defaultData();
    d.food.log['2026-02-30'] = [{ id: '', name: '', protein: -1, kcal: 'x', carbs: null, fat: null, from: 'nope' }];
    d.food.kcalTarget = 0;
    const problems = validate(d);
    expect(problems).toEqual(expect.arrayContaining([
      'food day "2026-02-30" is not a date',
      'food on 2026-02-30, entry 1 has no id',
      'food on 2026-02-30, entry 1 has no name',
      'food on 2026-02-30, entry 1 has an unknown source "nope"',
      'food on 2026-02-30, entry 1: protein must be a number of 0 or more, or empty',
      'food on 2026-02-30, entry 1: kcal must be a number of 0 or more, or empty',
      'the calorie target must be a whole number above 0, or empty',
    ]));
    expect(validate({ ...defaultData(), food: undefined })).toContain('food is missing');
  });
});

describe('the calorie target (Q-27: Martin does not know his number)', () => {
  it('suggests about 33 kcal per kg, rounded to 50; nothing without a weight', () => {
    expect(suggestKcal(77)).toBe(2550);
    expect(suggestKcal(80)).toBe(2650);
    expect(suggestKcal(null)).toBeNull();
  });

  it('the first 14 days with a target are learning days, without verdicts', () => {
    let d = setKcalTarget(defaultData(), 2550, NOW);
    expect(d.food).toMatchObject({ kcalTarget: 2550, kcalSince: TODAY });
    expect(learningDay(d, NOW)).toBe(1);
    expect(learningDay(d, new Date(2026, 10, 16 + LEARNING_DAYS - 1, 9))).toBe(LEARNING_DAYS);
    expect(learningDay(d, new Date(2026, 10, 16 + LEARNING_DAYS, 9))).toBeNull();
    d = setKcalTarget(d, 2400, new Date(2026, 10, 20));
    expect(d.food.kcalSince).toBe(TODAY); // changing the number does not restart the two weeks
    expect(setKcalTarget(d, '', NOW).food.kcalTarget).toBeNull();
    expect(validate(d)).toEqual([]);
  });

  it('the Today line', () => {
    let d = logFood(defaultData(), { name: 'Shake', protein: 25, kcal: 120, from: 'quick' }, NOW);
    expect(foodLine(d, NOW)).toBe('🍽 Food today: 120 kcal · 25g protein');
    d = setKcalTarget(d, 2550, NOW);
    expect(foodLine(d, NOW)).toBe('🍽 Food today: 120 / 2550 kcal · 25g protein (learning your days)');
  });
});

describe('schema 2: the migration from the Fridge before 0.9.8', () => {
  it('adds an empty food log and keeps every item', () => {
    const v1 = { items: [], waste: { used: 2, thrown: 1 }, products: { '5449000000996': { name: 'Cola', brand: 'X', nameEn: '', nameBg: '', fetchedAt: '2026-10-18T10:00:00.000Z' } } };
    v1.items = addItem({ ...v1 }, { name: 'Milk', location: 'fridge', expiry: '2026-11-20' }, NOW).data.items;
    expect(SCHEMA_VERSION).toBe(2);
    const v2 = runMigrations(v1, 1, 2, fridge.migrations);
    expect(v2.items).toEqual(v1.items);
    expect(v2.waste).toEqual(v1.waste);
    expect(v2.products).toEqual(v1.products);
    expect(v2.food.myFoods).toHaveLength(8);
    expect(validate(v2)).toEqual([]);
    expect(migrations[2]).toBeTypeOf('function');
  });
});

describe('Open Food Facts nutrition', () => {
  it('maps nutriments per 100 g (kcal from kJ when needed); none without kcal and protein', () => {
    expect(mapNutrition({ 'energy-kcal_100g': 389, proteins_100g: 13.2, carbohydrates_100g: 60, fat_100g: 7.04 })).toEqual({ kcal: 389, protein: 13.2, carbs: 60, fat: 7 });
    expect(mapNutrition({ energy_100g: 1046, proteins_100g: '3.4' })).toEqual({ kcal: 250, protein: 3.4, carbs: null, fat: null });
    expect(mapNutrition({ sugars_100g: 5 })).toBeNull();
    expect(mapProduct({ product_name: 'Oats', nutriments: { 'energy-kcal_100g': 389, proteins_100g: 13 } }).per100).toEqual({ kcal: 389, protein: 13, carbs: null, fat: null });
  });

  it('a cached product keeps its nutrition, and validate accepts it', () => {
    const d = cacheProduct(defaultData(), '5449000000996', { name: 'Oats', brand: '', nameEn: '', nameBg: '', per100: { kcal: 389, protein: 13, carbs: 60, fat: 7 } }, NOW);
    expect(d.products['5449000000996'].per100.kcal).toBe(389);
    expect(validate(d)).toEqual([]);
    d.products['5449000000996'].per100.kcal = -1;
    expect(validate(d)).toContain('product 5449000000996 has unreadable nutrition');
  });
});

describe('recipe links (docs/recipe-links.md)', () => {
  it('a link round-trips, with accents and dashes intact', () => {
    const link = recipeLink(RECIPE);
    expect(link.startsWith('https://martinlnoel.github.io/TheHub/#/fridge/recipe-import/')).toBe(true);
    expect(link.split('recipe-import/')[1]).toMatch(/^[A-Za-z0-9_-]+$/); // base64url: safe in a link
    const read = readRecipe(link);
    expect(read.ok).toBe(true);
    expect(read.recipe).toEqual({ name: RECIPE.name, servings: 2, ingredients: RECIPE.ingredients, steps: RECIPE.steps, perServing: RECIPE.perServing, notes: RECIPE.notes });
    expect(fromBase64Url(toBase64Url('Пиле — ёж'))).toBe('Пиле — ёж');
  });

  it("reads a link made with the Python snippet in docs/recipe-links.md (output pasted here verbatim)", () => {
    const fromPython = 'eyJ0aGVodWIiOiAicmVjaXBlIiwgInYiOiAxLCAibmFtZSI6ICJDaGlja2VuIHJpY2UgYm93bCIsICJzZXJ2aW5ncyI6IDIsICJpbmdyZWRpZW50cyI6IFsiMzAwIGcgY2hpY2tlbiBicmVhc3QiXSwgInN0ZXBzIjogW10sICJwZXJTZXJ2aW5nIjogeyJrY2FsIjogNTYwLCAicHJvdGVpbiI6IDQ1fX0';
    const read = readRecipe(`https://martinlnoel.github.io/TheHub/#/fridge/recipe-import/${fromPython}`);
    expect(read.ok).toBe(true);
    expect(read.recipe).toMatchObject({ name: 'Chicken rice bowl', servings: 2, steps: [], perServing: { kcal: 560, protein: 45, carbs: null, fat: null } });
  });

  it('also reads the bare payload and the JSON itself, pasted', () => {
    const payload = toBase64Url(JSON.stringify(RECIPE));
    expect(readRecipe(payload).ok).toBe(true);
    expect(readRecipe(`  ${JSON.stringify(RECIPE)}  `).ok).toBe(true);
    expect(readRecipe(encodeURIComponent(JSON.stringify(RECIPE))).ok).toBe(true);
  });

  it('explains what is wrong with a bad or cut-off link', () => {
    expect(readRecipe('').problems).toEqual(['Nothing was pasted.']);
    expect(readRecipe('https://example.com/#/fridge/recipe-import/%%%').ok).toBe(false);
    const cut = recipeLink(RECIPE).slice(0, -20);
    expect(readRecipe(cut).ok).toBe(false);
    expect(checkRecipe({ ...RECIPE, v: 2 }).problems).toContain('This recipe uses format version 2; this app reads version 1. Update TheHub.');
    expect(checkRecipe({ ...RECIPE, name: ' ', ingredients: [], perServing: { kcal: 300 } }).problems).toEqual([
      'The recipe has no name.',
      'The recipe has no ingredients.',
      'perServing needs at least kcal and protein.',
    ]);
    expect(checkRecipe({ ...RECIPE, servings: 0 }).problems).toContain('Servings must be a whole number from 1 to 50.');
    expect(checkRecipe({ ...RECIPE, perServing: { kcal: -5, protein: 10 } }).problems).toContain('perServing.kcal must be a number of 0 or more.');
  });

  it('saves, replaces one with the same name (keeping its id), deletes; servings scale', () => {
    const { recipe } = checkRecipe(RECIPE);
    const first = saveRecipe(defaultData(), recipe, NOW);
    expect(first.replaced).toBe(false);
    expect(validate(first.data)).toEqual([]);
    const second = saveRecipe(first.data, { ...recipe, name: RECIPE.name.toUpperCase(), servings: 3 }, NOW);
    expect(second.replaced).toBe(true);
    expect(second.data.food.recipes).toHaveLength(1);
    expect(second.recipe.id).toBe(first.recipe.id);
    expect(servingsOf(second.recipe, 1.5)).toEqual({ protein: 72, kcal: 780, carbs: 90, fat: 12 });
    expect(deleteRecipe(second.data, first.recipe.id).food.recipes).toEqual([]);
  });
});

describe("taking over the Gym's old protein log", () => {
  const archive = {
    proteinLogs: { '2026-11-15': [{ name: 'Whey shake', grams: 25 }, { name: 'Kip', grams: 30 }], '2026-11-16': [{ name: 'Eggs', grams: 24 }] },
    myFoods: [{ name: 'Snack - unknown', protein: 8 }, { name: 'Whey shake', protein: 25 }],
  };

  it('moves every entry once, with protein only; a second run adds nothing', () => {
    const d = mergeGymArchive(defaultData(), archive);
    expect(foodDay(d, '2026-11-15').entries.map((e) => [e.name, e.protein, e.kcal, e.from])).toEqual([['Whey shake', 25, null, 'gym'], ['Kip', 30, null, 'gym']]);
    expect(foodDay(d, '2026-11-16').totals.protein).toBe(24);
    expect(d.food.myFoods.map((f) => f.name)).toContain('Snack - unknown');
    expect(d.food.myFoods.filter((f) => f.name === 'Whey shake')).toHaveLength(1); // already a quick food
    expect(validate(d)).toEqual([]);
    expect(mergeGymArchive(d, archive)).toBeNull();
  });

  it('an entry deleted in the Fridge stays deleted; only new Gym entries come later', () => {
    const d = mergeGymArchive(defaultData(), archive);
    const gone = removeFood(d, '2026-11-15', 'g-2026-11-15-0');
    expect(mergeGymArchive(gone, archive)).toBeNull();
    const more = { ...archive, proteinLogs: { ...archive.proteinLogs, '2026-11-16': [...archive.proteinLogs['2026-11-16'], { name: 'Tuna', grams: 30 }] } };
    const next = mergeGymArchive(gone, more);
    expect(foodDay(next, '2026-11-16').entries.map((e) => e.name)).toEqual(['Eggs', 'Tuna']);
    expect(foodDay(next, '2026-11-15').entries.map((e) => e.name)).toEqual(['Kip']);
  });

  it('runs at start-up through the hub: the Gym answers, the Fridge accepts and saves; the Gym keeps its copy', async () => {
    const registry = createRegistry([gym, fridge]);
    const gymData = { ...gymDefault(), proteinLogs: archive.proteinLogs };
    const state = { gym: { data: gymData, readOnly: false }, fridge: { data: defaultData(), readOnly: false } };
    const save = vi.fn(async () => {});
    const hub = createHub({ registry, state, save });
    expect(await onStart({ hub })).toEqual({ accepted: true });
    expect(save).toHaveBeenCalledTimes(1);
    expect(foodDay(state.fridge.data, '2026-11-15').totals.protein).toBe(55);
    expect(state.gym.data.proteinLogs).toEqual(archive.proteinLogs); // untouched: an archive
    expect(await onStart({ hub })).toEqual({ accepted: false, reason: 'declined' });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('a read-only Fridge (newer data) is left alone', async () => {
    const registry = createRegistry([gym, fridge]);
    const state = { gym: { data: { ...gymDefault(), proteinLogs: archive.proteinLogs }, readOnly: false }, fridge: { data: defaultData(), readOnly: true } };
    const hub = createHub({ registry, state, save: vi.fn() });
    expect((await onStart({ hub })).accepted).toBe(false);
  });
});

describe('hub.ask and the contract', () => {
  it('answers with a copy, and null for anything missing or failing', () => {
    const registry = createRegistry([gym, fridge]);
    const fridgeData = logFood(defaultData(), { name: 'Shake', protein: 25, kcal: 120, from: 'quick' }, new Date());
    const state = { gym: { data: { ...gymDefault(), bodyweight: 77 }, readOnly: false }, fridge: { data: fridgeData, readOnly: false } };
    const hub = createHub({ registry, state, save: vi.fn() });
    expect(hub.ask('gym', 'bodyweight')).toBe(77);
    expect(hub.ask('gym', 'proteinTarget')).toBe(139);
    expect(hub.ask('fridge', 'foodDay').totals.protein).toBe(25);
    hub.ask('fridge', 'foodDay').entries.pop();
    expect(state.fridge.data.food.log[localDate()]).toHaveLength(1); // a copy: the answer cannot change the data
    expect(hub.ask('fridge', 'nope')).toBeNull();
    expect(hub.ask('nobody', 'foodDay')).toBeNull();
    const broken = createHub({ registry: createRegistry([{ ...fridge, answers: { boom: () => { throw new Error('x'); } } }]), state: { fridge: { data: defaultData() } }, save: vi.fn() });
    expect(broken.ask('fridge', 'boom')).toBeNull();
    expect(NO_HUB.ask('fridge', 'foodDay')).toBeNull();
  });

  it('the registry checks answers and onStart', () => {
    expect(checkModule(fridge)).toEqual([]);
    expect(checkModule(gym)).toEqual([]);
    expect(checkModule({ ...fridge, answers: { x: 1 } })).toContain('answers.x must be a function');
    expect(checkModule({ ...fridge, answers: [] })).toContain('answers must be an object of functions (or left out)');
    expect(checkModule({ ...fridge, onStart: 'later' })).toContain('onStart must be a function (or left out)');
  });
});

// ------------------------------------------------------------------------------------------ screens

function mountRoute(route, data, { params = '', hub = NO_HUB, readOnly = false } = {}) {
  const root = document.createElement('main');
  document.body.append(root);
  const saved = [];
  const ctx = { root, data, readOnly, params, hub, settings: {}, save: vi.fn(async (d) => saved.push(d)), navigate: vi.fn() };
  fridge.routes[route](ctx);
  return { root, ctx, saved };
}
const gymHub = (answers) => ({ accepts: () => false, offer: async () => ({ accepted: false }), ask: (id, q) => (id === 'gym' ? answers[q] ?? null : null) });

describe('the Food screen', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetScreenState();
  });

  it('has the Items, Food and Recipes tabs, today\'s totals and the protein target from the Gym', () => {
    const d = logFood(defaultData(), { name: 'Shake', protein: 25, kcal: 120, from: 'quick' }, new Date());
    const { root } = mountRoute('food', d, { hub: gymHub({ proteinTarget: 139, bodyweight: 77 }) });
    expect([...$(root, 'fridge-tabs').querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('aria-current')])).toEqual([['🧊Items', null], ['🍽Food', 'page'], ['📖Recipes', null]]);
    expect($(root, 'food-kcal').textContent).toBe('120');
    expect($(root, 'food-protein').textContent).toBe('25g');
    expect($(root, 'food-protein-note').textContent).toBe('⚡ 114g protein left');
    expect($(root, 'food-target').textContent).toContain('Suggested: 2550 kcal a day');
    expect($$(root, 'food-entry')).toHaveLength(1);
  });

  it('tap a quick food: it is logged and saved', async () => {
    const { root, saved } = mountRoute('food', defaultData());
    $$(root, 'food-chip')[2].click(); // Whey shake
    await flush();
    expect(saved).toHaveLength(1);
    expect(foodDay(saved[0]).entries.map((e) => [e.name, e.kcal, e.from])).toEqual([['Whey shake', 120, 'quick']]);
    expect($(root, 'food-flash').textContent).toBe('+ Whey shake');
    expect($(root, 'food-kcal').textContent).toBe('120');
  });

  it('use the suggested target; the note then says it is learning', async () => {
    const { root, saved } = mountRoute('food', defaultData(), { hub: gymHub({ bodyweight: 77, proteinTarget: 139 }) });
    $(root, 'food-target-use').click();
    await flush();
    expect(saved[0].food.kcalTarget).toBe(2550);
    expect($(root, 'food-kcal-note').textContent).toBe('Learning your days: day 1 of 14. No verdicts yet, just log what you eat.');
  });

  it('log a one-off, then remove it', async () => {
    const { root, saved } = mountRoute('food', defaultData());
    $(root, 'oneoff-name').value = 'Döner';
    $(root, 'oneoff-kcal').value = '650';
    $(root, 'oneoff-protein').value = '30';
    $(root, 'oneoff-log').click();
    await flush();
    expect(foodDay(saved[0]).entries[0]).toMatchObject({ name: 'Döner', kcal: 650, protein: 30, from: 'manual' });
    root.querySelector('[aria-label="Remove Döner"]').click();
    await flush();
    expect(foodDay(saved[1]).entries).toEqual([]);
  });

  it('a one-off without kcal or protein is refused', async () => {
    const { root, saved } = mountRoute('food', defaultData());
    $(root, 'oneoff-name').value = 'Mystery';
    $(root, 'oneoff-log').click();
    await flush();
    expect(saved).toEqual([]);
    expect(root.textContent).toContain('Enter at least kcal or protein.');
  });

  it('bug (found 2026-11-16 in a screenshot): two quick taps before the first save is done both count', async () => {
    const saves = [];
    const root = document.createElement('main');
    document.body.append(root);
    const ctx = { root, data: defaultData(), readOnly: false, params: '', hub: NO_HUB, settings: {}, save: (d) => new Promise((r) => saves.push({ d, r })), navigate: vi.fn() };
    fridge.routes.food(ctx);
    const chips = $$(root, 'food-chip');
    chips[2].click(); // Whey shake
    chips[1].click(); // 4 eggs, tapped on the same screen before the first save finished
    saves.forEach((s) => s.r());
    await flush();
    expect(foodDay(saves.at(-1).d).entries.map((e) => e.name)).toEqual(['Whey shake', '4 eggs']);
    expect($(root, 'food-kcal').textContent).toBe('410');
  });

  it('bug (found 2026-11-16 in a screenshot): a save that finishes after leaving the screen does not draw Food over the new screen', async () => {
    let finish;
    const root = document.createElement('main');
    document.body.append(root);
    const ctx = { root, data: defaultData(), readOnly: false, params: '', hub: NO_HUB, settings: {}, save: () => new Promise((r) => (finish = r)), navigate: vi.fn() };
    fridge.routes.food(ctx);
    $$(root, 'food-chip')[0].click();
    fridge.routes.recipes({ ...ctx, save: vi.fn() }); // Martin taps a recipe link before the save is done
    finish();
    await flush();
    expect($(root, 'fridge-recipes')).not.toBeNull();
    expect($(root, 'fridge-food')).toBeNull();
  });

  it('stored names are shown as text, never as markup', () => {
    const d = logFood(defaultData(), { name: '<img src=x onerror=alert(1)>', protein: 1, kcal: 1, from: 'manual' }, new Date());
    const { root } = mountRoute('food', d);
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('recipes on screen', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetScreenState();
  });

  it('a recipe link shows a preview; Save stores it and opens it', async () => {
    const payload = recipeLink(RECIPE).split('recipe-import/')[1];
    const { root, saved, ctx } = mountRoute('recipe-import/*', defaultData(), { params: payload });
    expect($(root, 'recipe-import-name').textContent).toBe(RECIPE.name);
    expect($(root, 'recipe-nutrition').textContent).toBe('Per serving: 520 kcal · 48g protein · 60g carbs · 8g fat');
    $(root, 'recipe-import-save').click();
    await flush();
    expect(saved[0].food.recipes[0].name).toBe(RECIPE.name);
    expect(ctx.navigate).toHaveBeenCalledWith(`#/fridge/recipe/${saved[0].food.recipes[0].id}`);
  });

  it('a broken link says so and saves nothing', () => {
    const { root, saved } = mountRoute('recipe-import/*', defaultData(), { params: 'not-a-recipe' });
    expect($(root, 'recipe-import-problem').textContent).toContain('This recipe link does not work');
    expect(saved).toEqual([]);
  });

  it('same name: warns that saving replaces it', () => {
    const d = saveRecipe(defaultData(), checkRecipe(RECIPE).recipe, NOW).data;
    const { root } = mountRoute('recipe-import/*', d, { params: recipeLink(RECIPE).split('recipe-import/')[1] });
    expect($(root, 'recipe-import-replace')).not.toBeNull();
    expect($(root, 'recipe-import-save').textContent).toBe('Replace recipe');
  });

  it('paste a link on the Recipes screen: it opens the preview', () => {
    const { root, ctx } = mountRoute('recipes', defaultData());
    expect($(root, 'recipe-ask').textContent).toContain('docs/recipe-links.md');
    $(root, 'recipe-paste').value = recipeLink(RECIPE);
    $(root, 'recipe-paste-add').click();
    expect(ctx.navigate.mock.calls[0][0]).toMatch(/^#\/fridge\/recipe-import\/[A-Za-z0-9_-]+$/);
    $(root, 'recipe-paste').value = 'hello';
    $(root, 'recipe-paste-add').click();
    expect($(root, 'recipe-paste-problem').textContent).toContain('not a TheHub recipe link');
  });

  it('a recipe: log 1.5 servings; delete takes two taps', async () => {
    const d = saveRecipe(defaultData(), checkRecipe(RECIPE).recipe, NOW);
    const { root, saved, ctx } = mountRoute('recipe/*', d.data, { params: d.recipe.id });
    $(root, 'recipe-servings').value = '1.5';
    $(root, 'recipe-ate').click();
    await flush();
    expect(foodDay(saved[0]).entries[0]).toMatchObject({ name: `${RECIPE.name} × 1.5`, kcal: 780, protein: 72, from: 'recipe' });
    expect(ctx.navigate).toHaveBeenCalledWith('#/fridge/food');

    const again = mountRoute('recipe/*', d.data, { params: d.recipe.id });
    $(again.root, 'recipe-delete').click();
    expect($(again.root, 'recipe-delete').textContent).toBe('Tap again to delete');
    $(again.root, 'recipe-delete').click();
    await flush();
    expect(again.saved[0].food.recipes).toEqual([]);
  });

  it('recipes show on the Food screen as one-serving chips', async () => {
    const d = saveRecipe(defaultData(), checkRecipe(RECIPE).recipe, NOW).data;
    const { root, saved } = mountRoute('food', d);
    $$(root, 'food-recipe-chip')[0].click();
    await flush();
    expect(foodDay(saved[0]).entries[0]).toMatchObject({ name: RECIPE.name, kcal: 520, from: 'recipe' });
  });
});

describe('"Ate some" on an item', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetScreenState();
  });

  it('a scanned product with nutrition: grams in, the portion logged', async () => {
    let d = addItem(defaultData(), { name: 'Oats', barcode: '5449000000996', location: 'pantry' }, NOW);
    const item = d.item;
    d = cacheProduct(d.data, '5449000000996', { name: 'Oats', brand: '', nameEn: '', nameBg: '', per100: { kcal: 389, protein: 13, carbs: 60, fat: 7 } }, NOW);
    const { root, saved, ctx } = mountRoute('item/*', d, { params: item.id });
    const grams = $(root, 'eat-grams');
    grams.value = '80';
    grams.dispatchEvent(new Event('input'));
    expect($(root, 'eat-preview').textContent).toBe('80 g: 311 kcal · 10g protein · 48g carbs · 6g fat');
    $(root, 'eat-log').click();
    await flush();
    expect(foodDay(saved[0]).entries[0]).toMatchObject({ name: 'Oats 80g', kcal: 311.2, protein: 10.4, from: 'item' });
    expect(saved[0].items).toHaveLength(1); // still in the pantry
    expect(ctx.navigate).toHaveBeenCalledWith('#/fridge/food');
  });

  it('without nutrition: type it in', async () => {
    const d = addItem(defaultData(), { name: 'Soup', location: 'fridge' }, NOW);
    const { root, saved } = mountRoute('item/*', d.data, { params: d.item.id });
    expect($(root, 'eat-lookup')).toBeNull(); // no barcode, nothing to look up
    $(root, 'eat-kcal').value = '200';
    $(root, 'eat-log').click();
    await flush();
    expect(foodDay(saved[0]).entries[0]).toMatchObject({ name: 'Soup', kcal: 200, protein: null, from: 'item' });
  });
});
