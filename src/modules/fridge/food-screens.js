// The Fridge's food screens (0.9.8): Food (#/fridge/food: today's protein and calories, quick foods, recipes,
// a one-off), Recipes (#/fridge/recipes), one recipe (#/fridge/recipe/<id>), a recipe link
// (#/fridge/recipe-import/<payload>), and the "Ate some" card on an item. Logic: food.js and recipes.js.
import { h, mount } from '../../core/dom.js';
import { localDate } from '../../core/dates.js';
import { NO_HUB } from '../../core/hub.js';
import { VERSION } from '../../version.js';
import { cacheProduct } from './data.js';
import {
  LEARNING_DAYS, addMyFood, amount, deleteMyFood, foodDay, learningDay, logFood, nutritionOf, portion, removeFood, setKcalTarget, suggestKcal,
} from './food.js';
import { lookupProduct } from './off.js';
import { deleteRecipe, readRecipe, recipeLink, saveRecipe, sameName, servingsOf, toBase64Url } from './recipes.js';

export const GUIDE_URL = 'https://github.com/MartinLNoel/TheHub/blob/main/docs/recipe-links.md';
export const CLAUDE_ASK = `Turn this recipe into a TheHub recipe link, following ${GUIDE_URL}`;

let flash = '';
let confirmDelete = null;

/** A message for the Food screen's next render (used by the item screen after "Ate some"). */
export function setFoodFlash(text) {
  flash = text;
}

export function resetFoodScreenState() {
  flash = '';
  confirmDelete = null;
}

function takeFlash() {
  const text = flash;
  flash = '';
  return text ? h('p', { class: 'status status--good fridge-flash', role: 'status', 'data-testid': 'food-flash' }, text) : null;
}

function readOnlyNote(readOnly) {
  return readOnly ? h('p', { class: 'card card--warn' }, 'Read-only until the app updates: nothing can be saved.') : null;
}

const TABS = [
  { id: 'items', href: '#/fridge', icon: '🧊', label: 'Items' },
  { id: 'food', href: '#/fridge/food', icon: '🍽', label: 'Food' },
  { id: 'recipes', href: '#/fridge/recipes', icon: '📖', label: 'Recipes' },
];

/** The Fridge's sub-tabs (Items, Food, Recipes). */
export function fridgeTabs(active) {
  return h(
    'nav',
    { class: 'fridge-tabs', 'aria-label': 'Fridge', 'data-testid': 'fridge-tabs' },
    TABS.map((t) => h('a', { href: t.href, class: 'gym-tab fridge-tab', 'aria-current': t.id === active ? 'page' : null }, h('span', { class: 'gym-tab__icon', 'aria-hidden': 'true' }, t.icon), h('span', { class: 'gym-tab__label' }, t.label))),
  );
}

/** "520 kcal · 42g protein · 50g carbs · 14g fat" (unknown values left out). */
export function nutritionText(n) {
  const parts = [];
  if (n.kcal !== null && n.kcal !== undefined) parts.push(`${Math.round(n.kcal)} kcal`);
  if (n.protein !== null && n.protein !== undefined) parts.push(`${Math.round(n.protein)}g protein`);
  if (n.carbs !== null && n.carbs !== undefined) parts.push(`${Math.round(n.carbs)}g carbs`);
  if (n.fat !== null && n.fat !== undefined) parts.push(`${Math.round(n.fat)}g fat`);
  return parts.join(' · ') || 'no nutrition known';
}

function bar(pct) {
  return h('div', { class: 'food-bar', 'aria-hidden': 'true' }, h('div', { class: 'food-bar__fill', style: `width:${Math.min(100, Math.max(0, pct))}%` }));
}

function numberField(label, testid, value = '') {
  const input = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', value, 'aria-label': label, 'data-testid': testid });
  return { input, el: h('label', { class: 'field food-num' }, label, input) };
}

/** A small form for name + nutrition. Returns { el, values(), reset() }. */
function nutritionForm(prefix, { withName = true } = {}) {
  const name = h('input', { type: 'text', placeholder: 'e.g. Pasta bolognese', 'aria-label': 'Name', 'data-testid': `${prefix}-name` });
  const fields = { protein: numberField('Protein (g)', `${prefix}-protein`), kcal: numberField('kcal', `${prefix}-kcal`), carbs: numberField('Carbs (g)', `${prefix}-carbs`), fat: numberField('Fat (g)', `${prefix}-fat`) };
  return {
    el: h('div', { class: 'fridge-form' }, withName ? h('label', { class: 'field' }, 'Name', name) : null, h('div', { class: 'food-nums' }, Object.values(fields).map((f) => f.el))),
    values: () => ({ name: name.value.trim(), ...nutritionOf(Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.input.value]))) }),
    reset: () => {
      name.value = '';
      for (const f of Object.values(fields)) f.input.value = '';
    },
  };
}

async function saveOr(ctx, next, problem) {
  try {
    await ctx.save(next);
    return true;
  } catch (err) {
    if (problem) problem.textContent = `Not saved: ${err.message}`;
    return false;
  }
}

// ---------------------------------------------------------------------------------------------- Food

export function renderFood(ctx) {
  const { root, readOnly } = ctx;
  // Every change builds on the latest data, not on what this screen was drawn with: two quick taps before the
  // first save is done must both count (bug found 2026-11-16).
  const live = ctx.live || { data: ctx.data };
  const data = live.data;
  const hub = ctx.hub || NO_HUB;
  const now = new Date();
  const today = localDate(now);
  const day = foodDay(data, today);
  const t = day.totals;
  const kcalTarget = data.food.kcalTarget;
  const proteinTarget = hub.ask('gym', 'proteinTarget');
  const learning = learningDay(data, now);
  const problem = h('p', { class: 'status status--bad', role: 'alert' });
  // Redraw only while this screen is still showing: a save that finishes after Martin left (a recipe link
  // tapped right after a quick add) must not draw Food over the new screen (bug found 2026-11-16).
  let page = null;
  const again = (message) => {
    if (page && !page.isConnected) return;
    if (message) flash = message;
    renderFood({ ...ctx, live, data: live.data });
  };
  /** change(latestData) => next; message: text, or (next) => text. */
  const commit = async (change, message) => {
    const prev = live.data;
    const next = change(prev);
    live.data = next;
    if (await saveOr(ctx, next, problem)) again(typeof message === 'function' ? message(next) : message);
    else if (live.data === next) live.data = prev;
  };
  const log = (entry, message) => commit((d) => logFood(d, entry, new Date()), message);

  // --- today's totals
  const kcalPct = kcalTarget ? Math.round((t.kcal / kcalTarget) * 100) : 0;
  const proteinPct = proteinTarget ? Math.round((t.protein / proteinTarget) * 100) : 0;
  let kcalNote;
  if (!kcalTarget) kcalNote = 'No calorie target yet: pick one below.';
  else if (learning) kcalNote = `Learning your days: day ${learning} of ${LEARNING_DAYS}. No verdicts yet, just log what you eat.`;
  else kcalNote = t.kcal <= kcalTarget ? `${kcalTarget - t.kcal} kcal left today` : `${t.kcal - kcalTarget} kcal over today`;
  const totalsCard = h(
    'section',
    { class: 'card food-today', 'data-testid': 'food-today' },
    h('h2', {}, 'Today'),
    h('p', { class: 'food-big' }, h('strong', { 'data-testid': 'food-kcal' }, String(t.kcal)), h('span', { class: 'muted' }, kcalTarget ? ` / ${kcalTarget} kcal` : ' kcal')),
    kcalTarget ? bar(kcalPct) : null,
    h('p', { class: 'muted fridge-small', 'data-testid': 'food-kcal-note' }, kcalNote),
    t.kcalUnknown ? h('p', { class: 'muted fridge-small' }, `${t.kcalUnknown} entr${t.kcalUnknown === 1 ? 'y has' : 'ies have'} no kcal (moved from the Gym's protein log).`) : null,
    h('p', { class: 'food-big' }, h('strong', { 'data-testid': 'food-protein' }, `${t.protein}g`), h('span', { class: 'muted' }, proteinTarget ? ` / ${proteinTarget}g protein` : ' protein')),
    proteinTarget ? bar(proteinPct) : null,
    h(
      'p',
      { class: 'muted fridge-small', 'data-testid': 'food-protein-note' },
      proteinTarget ? (t.protein >= proteinTarget ? '✅ Protein target hit' : `⚡ ${proteinTarget - t.protein}g protein left`) : 'Protein target: enter your weight in Gym → Check-in.',
    ),
    h('p', { class: 'muted fridge-small' }, `Carbs ${t.carbs}g · Fat ${t.fat}g`),
  );

  // --- calorie target (Q-27)
  const bodyweight = hub.ask('gym', 'bodyweight');
  const suggestion = suggestKcal(bodyweight);
  const targetIn = h('input', { type: 'number', inputmode: 'numeric', min: '800', max: '6000', step: '50', value: kcalTarget ?? '', placeholder: 'kcal', 'aria-label': 'Calorie target (kcal a day)', 'data-testid': 'food-target-input' });
  const setTarget = (value) =>
    commit((d) => setKcalTarget(d, value, new Date()), (next) => (next.food.kcalTarget ? `Calorie target: ${next.food.kcalTarget} kcal a day.` : 'Calorie target removed.'));
  const targetForm = h(
    'div',
    { class: 'row food-target-row' },
    targetIn,
    h('button', { type: 'button', class: 'btn', disabled: readOnly, 'data-testid': 'food-target-save', onclick: () => setTarget(targetIn.value) }, 'Save'),
  );
  const targetCard = !kcalTarget
    ? h(
        'section',
        { class: 'card', 'data-testid': 'food-target' },
        h('h2', {}, 'Calorie target'),
        suggestion
          ? [
              h('p', {}, 'Suggested: ', h('strong', {}, `${suggestion} kcal a day`)),
              h('p', { class: 'muted fridge-small' }, `About 33 kcal per kg of your ${bodyweight} kg: a common estimate to start from, not a measurement. The first ${LEARNING_DAYS} days show no verdicts, so you can see what you really eat and adjust.`),
              h('button', { type: 'button', class: 'btn btn--primary', disabled: readOnly, 'data-testid': 'food-target-use', onclick: () => setTarget(suggestion) }, `Use ${suggestion} kcal`),
            ]
          : h('p', { class: 'muted fridge-small' }, 'Enter your weight in Gym → Check-in for a suggestion, or type a number.'),
        h('p', { class: 'fridge-small' }, 'Or your own number:'),
        targetForm,
      )
    : h('details', { class: 'card food-details', 'data-testid': 'food-target' }, h('summary', {}, `Calorie target: ${kcalTarget} kcal a day`), h('p', { class: 'muted fridge-small' }, 'Change it any time.'), targetForm);

  // --- quick foods
  const foods = data.food.myFoods;
  const newFood = nutritionForm('myfood');
  const newFoodBox = h(
    'div',
    { class: 'food-new', hidden: true },
    newFood.el,
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          disabled: readOnly,
          'data-testid': 'myfood-save',
          onclick: async () => {
            const v = newFood.values();
            if (!v.name) return (problem.textContent = 'Give the food a name.');
            if (v.kcal === null && v.protein === null) return (problem.textContent = 'Enter at least kcal or protein.');
            await commit((d) => addMyFood(d, v), `${v.name} saved as a quick food.`);
          },
        },
        'Save food',
      ),
      h('button', { type: 'button', class: 'btn', onclick: () => (newFoodBox.hidden = true) }, 'Cancel'),
    ),
  );
  const quickCard = h(
    'section',
    { class: 'card', 'data-testid': 'food-quick' },
    h('div', { class: 'food-head' }, h('h2', {}, 'Quick add'), h('button', { type: 'button', class: 'btn', disabled: readOnly, 'data-testid': 'myfood-new', onclick: () => (newFoodBox.hidden = false) }, '＋ Food')),
    newFoodBox,
    foods.length
      ? h(
          'div',
          { class: 'gym-chips' },
          foods.map((f) =>
            h(
              'span',
              { class: 'gym-chip-pair' },
              h('button', { type: 'button', class: 'gym-chip', disabled: readOnly, 'data-testid': 'food-chip', onclick: () => log({ ...f, from: 'quick' }, `+ ${f.name}`) }, `${f.name} `, h('strong', {}, f.kcal !== null ? `${Math.round(f.kcal)} kcal` : `${f.protein ?? 0}g`)),
              h(
                'button',
                {
                  type: 'button',
                  class: 'gym-chip gym-chip--x',
                  disabled: readOnly,
                  'aria-label': `Delete quick food ${f.name}`,
                  onclick: () => commit((d) => deleteMyFood(d, f.id), `${f.name} removed from quick add.`),
                },
                '×',
              ),
            ),
          ),
        )
      : h('p', { class: 'muted fridge-small' }, 'No quick foods. Add your own with ＋ Food.'),
  );

  // --- recipes
  const recipes = data.food.recipes;
  const recipeCard = recipes.length
    ? h(
        'section',
        { class: 'card', 'data-testid': 'food-recipes' },
        h('h2', {}, 'From a recipe (1 serving)'),
        h('div', { class: 'gym-chips' }, recipes.map((r) => h('button', { type: 'button', class: 'gym-chip', disabled: readOnly, 'data-testid': 'food-recipe-chip', onclick: () => log({ name: r.name, ...servingsOf(r, 1), from: 'recipe' }, `+ 1 serving of ${r.name}`) }, `${r.name} `, h('strong', {}, `${Math.round(r.perServing.kcal)} kcal`)))),
      )
    : null;

  // --- one-off
  const once = nutritionForm('oneoff');
  const onceCard = h(
    'details',
    { class: 'card food-details', 'data-testid': 'food-oneoff' },
    h('summary', {}, 'Something else (type it in)'),
    once.el,
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary',
        disabled: readOnly,
        'data-testid': 'oneoff-log',
        onclick: async () => {
          const v = once.values();
          if (!v.name) return (problem.textContent = 'Give it a name.');
          if (v.kcal === null && v.protein === null) return (problem.textContent = 'Enter at least kcal or protein.');
          await log({ ...v, from: 'manual' }, `+ ${v.name}`);
        },
      },
      'Log it',
    ),
    h('p', { class: 'muted fridge-small' }, 'Something in the fridge? Open it under Items and use "Ate some": scanned products know their nutrition.'),
  );

  // --- today's list
  const listCard = h(
    'section',
    { class: 'card', 'data-testid': 'food-log' },
    h('h2', {}, "Today's log"),
    day.entries.length
      ? h(
          'ul',
          { class: 'food-list' },
          day.entries.map((e) =>
            h(
              'li',
              { class: 'food-row', 'data-testid': 'food-entry' },
              h('span', { class: 'food-row__main' }, h('strong', {}, e.name), h('span', { class: 'muted fridge-small' }, nutritionText(e))),
              h(
                'button',
                {
                  type: 'button',
                  class: 'gym-chip gym-chip--x food-row__x',
                  disabled: readOnly,
                  'aria-label': `Remove ${e.name}`,
                  onclick: () => commit((d) => removeFood(d, today, e.id), `${e.name} removed.`),
                },
                '×',
              ),
            ),
          ),
        )
      : h('p', { class: 'muted fridge-small' }, 'Nothing logged yet today.'),
  );

  page = h('div', { class: 'stack fridge food', 'data-testid': 'fridge-food' }, fridgeTabs('food'), takeFlash(), readOnlyNote(readOnly), totalsCard, problem, quickCard, recipeCard, onceCard, listCard, targetCard);
  mount(root, page);
}

// ---------------------------------------------------------------------------------------------- Recipes

function copyButton(text, label, testid) {
  const btn = h('button', { type: 'button', class: 'btn', 'data-testid': testid }, label);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied ✓';
    } catch {
      btn.textContent = 'Copy failed: select the text instead';
    }
  });
  return btn;
}

export function renderRecipes(ctx) {
  const { root, readOnly } = ctx;
  const recipes = [...ctx.data.food.recipes].sort((a, b) => a.name.localeCompare(b.name));
  const box = h('textarea', { rows: '3', placeholder: 'Paste a recipe link here', 'aria-label': 'Recipe link', 'data-testid': 'recipe-paste' });
  const problem = h('div', { class: 'status status--bad', role: 'alert', 'data-testid': 'recipe-paste-problem' });
  const add = () => {
    const result = readRecipe(box.value);
    if (!result.ok) {
      mount(problem, result.problems.map((p) => h('p', {}, p)));
      return;
    }
    ctx.navigate(`#/fridge/recipe-import/${toBase64Url(JSON.stringify({ thehub: 'recipe', v: 1, ...result.recipe }))}`);
  };
  mount(
    root,
    h(
      'div',
      { class: 'stack fridge food', 'data-testid': 'fridge-recipes' },
      fridgeTabs('recipes'),
      takeFlash(),
      readOnlyNote(readOnly),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Add a recipe'),
        h('p', { class: 'fridge-small' }, 'Plan the recipe with Claude, then ask it:'),
        h('p', { class: 'food-ask', 'data-testid': 'recipe-ask' }, CLAUDE_ASK),
        copyButton(CLAUDE_ASK, 'Copy this request', 'recipe-ask-copy'),
        h('p', { class: 'muted fridge-small' }, 'Tap the link Claude gives you, or paste it here:'),
        box,
        problem,
        h('button', { type: 'button', class: 'btn btn--primary', disabled: readOnly, 'data-testid': 'recipe-paste-add', onclick: add }, 'Open the recipe'),
      ),
      h(
        'section',
        { class: 'card', 'data-testid': 'recipe-list' },
        h('h2', {}, `Recipes (${recipes.length})`),
        recipes.length
          ? h(
              'ul',
              { class: 'fridge-list' },
              recipes.map((r) =>
                h('li', {}, h('a', { class: 'fridge-item', href: `#/fridge/recipe/${r.id}`, 'data-testid': 'recipe-row' }, h('span', { class: 'fridge-item__main' }, h('strong', { class: 'fridge-item__name' }, r.name), h('span', { class: 'fridge-item__meta' }, `${r.servings} serving${r.servings === 1 ? '' : 's'} · per serving ${nutritionText(r.perServing)}`)))),
              ),
            )
          : h('p', { class: 'muted fridge-small' }, 'No recipes yet.'),
      ),
    ),
  );
}

function recipeBody(r) {
  return [
    h('p', { class: 'muted' }, `${r.servings} serving${r.servings === 1 ? '' : 's'}`),
    h('p', { 'data-testid': 'recipe-nutrition' }, h('strong', {}, 'Per serving: '), nutritionText(r.perServing)),
    h('h3', {}, 'Ingredients'),
    h('ul', { class: 'food-recipe-list' }, r.ingredients.map((x) => h('li', {}, x))),
    r.steps.length ? [h('h3', {}, 'Steps'), h('ol', { class: 'food-recipe-list' }, r.steps.map((x) => h('li', {}, x)))] : null,
    r.notes ? [h('h3', {}, 'Notes'), h('p', { class: 'food-notes' }, r.notes)] : null,
  ];
}

export function renderRecipe(ctx) {
  const { root, readOnly } = ctx;
  const data = ctx.data;
  const r = data.food.recipes.find((x) => x.id === ctx.params);
  if (!r) {
    mount(root, h('div', { class: 'stack fridge food' }, fridgeTabs('recipes'), h('section', { class: 'card', 'data-testid': 'recipe-gone' }, h('p', {}, 'This recipe is no longer saved.'))));
    return;
  }
  const problem = h('p', { class: 'status status--bad', role: 'alert' });
  const count = h('input', { type: 'number', inputmode: 'decimal', min: '0.25', step: '0.25', value: '1', 'aria-label': 'Servings eaten', 'data-testid': 'recipe-servings' });
  const deleting = confirmDelete === r.id;
  mount(
    root,
    h(
      'div',
      { class: 'stack fridge food', 'data-testid': 'recipe-screen' },
      fridgeTabs('recipes'),
      takeFlash(),
      readOnlyNote(readOnly),
      h('section', { class: 'card' }, h('h2', {}, r.name), recipeBody(r)),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Ate it'),
        h('label', { class: 'field food-num' }, 'Servings', count),
        problem,
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary',
            disabled: readOnly,
            'data-testid': 'recipe-ate',
            onclick: async () => {
              const n = amount(count.value);
              if (!n) return (problem.textContent = 'How many servings?');
              const next = logFood(data, { name: n === 1 ? r.name : `${r.name} × ${n}`, ...servingsOf(r, n), from: 'recipe' }, new Date());
              if (await saveOr(ctx, next, problem)) {
                flash = `+ ${n} serving${n === 1 ? '' : 's'} of ${r.name}`;
                ctx.navigate('#/fridge/food');
              }
            },
          },
          '🍽 Log it',
        ),
      ),
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'row' }, copyButton(recipeLink(r), '🔗 Copy link', 'recipe-copy-link')),
        h(
          'button',
          {
            type: 'button',
            class: deleting ? 'btn btn--danger' : 'btn',
            disabled: readOnly,
            'data-testid': 'recipe-delete',
            onclick: async () => {
              if (!deleting) {
                confirmDelete = r.id;
                renderRecipe(ctx);
                return;
              }
              confirmDelete = null;
              const next = deleteRecipe(data, r.id);
              if (await saveOr(ctx, next, problem)) {
                flash = `${r.name} deleted.`;
                ctx.navigate('#/fridge/recipes');
              }
            },
          },
          deleting ? 'Tap again to delete' : 'Delete recipe',
        ),
      ),
    ),
  );
}

export function renderImport(ctx) {
  const { root, readOnly } = ctx;
  const data = ctx.data;
  const result = readRecipe(ctx.params);
  if (!result.ok) {
    mount(
      root,
      h(
        'div',
        { class: 'stack fridge food', 'data-testid': 'recipe-import' },
        fridgeTabs('recipes'),
        h('section', { class: 'card card--warn', 'data-testid': 'recipe-import-problem' }, h('h2', {}, 'This recipe link does not work'), result.problems.map((p) => h('p', {}, p)), h('p', { class: 'muted fridge-small' }, 'Ask Claude to make the link again, following the guide.')),
        h('a', { class: 'btn', href: '#/fridge/recipes' }, '← Recipes'),
      ),
    );
    return;
  }
  const recipe = result.recipe;
  const old = sameName(data, recipe.name);
  const problem = h('p', { class: 'status status--bad', role: 'alert' });
  mount(
    root,
    h(
      'div',
      { class: 'stack fridge food', 'data-testid': 'recipe-import' },
      fridgeTabs('recipes'),
      readOnlyNote(readOnly),
      h('section', { class: 'card' }, h('p', { class: 'gym-kicker' }, 'NEW RECIPE'), h('h2', { 'data-testid': 'recipe-import-name' }, recipe.name), recipeBody(recipe)),
      old ? h('p', { class: 'card card--warn', 'data-testid': 'recipe-import-replace' }, `You already have a recipe called "${old.name}". Saving replaces it.`) : null,
      problem,
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary',
            disabled: readOnly,
            'data-testid': 'recipe-import-save',
            onclick: async () => {
              const saved = saveRecipe(data, recipe, new Date());
              if (await saveOr(ctx, saved.data, problem)) {
                flash = saved.replaced ? `${recipe.name}: updated.` : `${recipe.name}: saved.`;
                ctx.navigate(`#/fridge/recipe/${saved.recipe.id}`);
              }
            },
          },
          old ? 'Replace recipe' : 'Save recipe',
        ),
        h('a', { class: 'btn', href: '#/fridge/recipes' }, 'Cancel'),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------- an item

/**
 * "Ate some" on an item's screen: grams of a scanned product whose nutrition Open Food Facts knows, otherwise
 * the numbers typed in (with a lookup button when the item has a barcode).
 */
export function eatCard(ctx, item, { onLogged, lookup = (code) => lookupProduct(code, { appVersion: VERSION }) } = {}) {
  const { readOnly } = ctx;
  const data = ctx.data;
  const per100 = item.barcode ? data.products[item.barcode]?.per100 : null;
  const problem = h('p', { class: 'status status--bad', role: 'alert' });
  const status = h('p', { class: 'status', role: 'status', 'data-testid': 'eat-status' });
  const card = h('section', { class: 'card', 'data-testid': 'eat-card' });
  const done = async (entry) => {
    const next = logFood(data, { ...entry, from: 'item' }, new Date());
    if (await saveOr(ctx, next, problem)) onLogged?.(next, entry);
  };

  if (per100) {
    const grams = h('input', { type: 'number', inputmode: 'decimal', min: '1', step: 'any', placeholder: 'g', 'aria-label': 'Grams eaten', 'data-testid': 'eat-grams' });
    const preview = h('p', { class: 'muted fridge-small', 'data-testid': 'eat-preview' }, `Per 100 g: ${nutritionText(per100)}`);
    grams.addEventListener('input', () => {
      const p = portion(per100, grams.value);
      preview.textContent = p ? `${grams.value} g: ${nutritionText(p)}` : `Per 100 g: ${nutritionText(per100)}`;
    });
    mount(
      card,
      h('h2', {}, '🍽 Ate some'),
      h('label', { class: 'field food-num' }, 'How many grams?', grams),
      preview,
      problem,
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          disabled: readOnly,
          'data-testid': 'eat-log',
          onclick: () => {
            const p = portion(per100, grams.value);
            if (!p) return (problem.textContent = 'How many grams?');
            return done({ name: `${item.name} ${amount(grams.value)}g`, ...p });
          },
        },
        'Log it',
      ),
    );
    return card;
  }

  const form = nutritionForm('eat', { withName: false });
  mount(
    card,
    h('h2', {}, '🍽 Ate some'),
    h('p', { class: 'muted fridge-small' }, item.barcode ? 'Open Food Facts gave no nutrition for this product yet. Look it up, or type what you ate:' : 'Type what you ate (the label on the pack helps):'),
    item.barcode
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn',
            disabled: readOnly,
            'data-testid': 'eat-lookup',
            onclick: async () => {
              status.textContent = 'Looking up…';
              const result = await lookup(item.barcode);
              if (result.status !== 'found' || !result.product.per100) {
                status.textContent = result.status === 'error' ? 'Could not reach Open Food Facts. Are you online?' : 'Open Food Facts has no nutrition for this product.';
                return;
              }
              const next = cacheProduct(data, item.barcode, result.product);
              if (await saveOr(ctx, next, problem)) onLogged?.(next, null);
            },
          },
          'Look up nutrition',
        )
      : null,
    status,
    form.el,
    problem,
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary',
        disabled: readOnly,
        'data-testid': 'eat-log',
        onclick: () => {
          const v = form.values();
          if (v.kcal === null && v.protein === null) return (problem.textContent = 'Enter at least kcal or protein.');
          return done({ ...v, name: item.name });
        },
      },
      'Log it',
    ),
  );
  return card;
}

