// E2E tests for the Fridge's food log and recipes (0.9.8) at a phone viewport: logging food, the Gym's read-only
// Protein tab, a recipe link, and the upgrade from a Fridge before 0.9.8 (backed up first, the Gym's old protein
// log taken over). GitHub is never called: the in-memory fake answers (tests/fixtures/fake-github.js).
import { expect, test } from '@playwright/test';
import { TEST_TOKEN, createFakeGitHub } from '../fixtures/fake-github.js';
import { recipeLink } from '../../src/modules/fridge/recipes.js';

test.use({ serviceWorkers: 'block' });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
};

async function routeGitHub(page, fake) {
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const res = await fake.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() });
    return route.fulfill({ status: res.status, headers: { ...CORS, 'content-type': res.headers.get('content-type') || 'text/plain' }, body: await res.text() });
  });
}

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

/** Puts documents into the app's IndexedDB stores ({ store: { key: value } }); the caller reloads. */
async function seed(page, stores) {
  await page.evaluate(async (all) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('thehub');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(Object.keys(all), 'readwrite');
    for (const [store, values] of Object.entries(all)) for (const [k, v] of Object.entries(values)) tx.objectStore(store).put(v, k);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, stores);
}

async function readDoc(page, store) {
  return page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('thehub');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const value = await new Promise((resolve) => {
      const g = db.transaction(id).objectStore(id).get('doc');
      g.onsuccess = () => resolve(g.result);
    });
    db.close();
    return value;
  }, store);
}

const RECIPE = {
  thehub: 'recipe',
  v: 1,
  name: 'Overnight oats',
  servings: 1,
  ingredients: ['60 g oats', '200 ml milk', '1 scoop whey'],
  steps: ['Mix everything.', 'Leave in the fridge overnight.'],
  perServing: { kcal: 560, protein: 45, carbs: 60, fat: 12 },
};

test('log food in the Fridge; the Gym Protein tab and Today read it', async ({ page }) => {
  await open(page, '#/gym/checkin');
  await page.getByTestId('ci-weight').fill('77');
  await page.getByTestId('ci-save').click();
  await expect(page.locator('#gym-toast')).toHaveText('CHECK-IN SAVED ✓');

  await page.goto('./#/fridge/food');
  await expect(page.getByTestId('food-target')).toContainText('Suggested: 2550 kcal a day');
  await page.getByTestId('food-target-use').click();
  await expect(page.getByTestId('food-kcal-note')).toHaveText('Learning your days: day 1 of 14. No verdicts yet, just log what you eat.');
  await page.getByRole('button', { name: /Whey shake 120 kcal/ }).click();
  await page.getByTestId('food-oneoff').locator('summary').click();
  await page.getByTestId('oneoff-name').fill('Kippenbouten');
  await page.getByTestId('oneoff-protein').fill('30');
  await page.getByTestId('oneoff-kcal').fill('250');
  await page.getByTestId('oneoff-log').click();
  await expect(page.getByTestId('food-kcal')).toHaveText('370');
  await expect(page.getByTestId('food-protein')).toHaveText('55g');
  await expect(page.getByTestId('food-protein-note')).toHaveText(`⚡ ${Math.round(77 * 1.8) - 55}g protein left`);

  await page.goto('./#/gym/protein');
  await expect(page.getByTestId('gym-protein-total')).toHaveText('55');
  await expect(page.getByTestId('gym-kcal-today')).toHaveText('370 / 2550 kcal today');
  await expect(page.getByTestId('gym-protein-log')).toContainText('Kippenbouten');
  await expect(page.getByTestId('custom-food-add')).toHaveCount(0); // read-only: no logging here
  await page.getByTestId('gym-to-fridge').click();
  await expect(page).toHaveURL(/#\/fridge\/food$/);

  await page.locator('#nav [data-section="today"]').click();
  await expect(page.locator('[data-module="gym"]')).toContainText(`Protein: ${Math.round(77 * 1.8) - 55}g left today`);
  await expect(page.locator('[data-module="fridge"]')).toContainText('🍽 Food today: 370 / 2550 kcal · 55g protein (learning your days)');
});

test('a recipe link: tap it, save, and log a serving; it survives a reload', async ({ page }) => {
  await open(page);
  const link = recipeLink(RECIPE, '');
  await page.goto(`./${link}`);
  await expect(page.getByTestId('recipe-import-name')).toHaveText('Overnight oats');
  await page.getByTestId('recipe-import-save').click();
  await expect(page.getByTestId('recipe-screen')).toContainText('Leave in the fridge overnight.');
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.getByTestId('recipe-ate')).toHaveCount(0);
  await page.goto('./#/fridge/food');
  await page.getByTestId('food-filter-recipes').click();
  await page.getByRole('button', { name: /^Overnight oats, 1 serving/ }).click();
  await expect(page.getByTestId('food-kcal')).toHaveText('560');
  await page.goto('./#/fridge/recipes');
  await expect(page.getByTestId('recipe-row')).toHaveCount(1);
});

test('upgrade: a Fridge from before 0.9.8 is backed up, converted, and takes over the Gym protein log', async ({ page }) => {
  const fake = createFakeGitHub();
  await routeGitHub(page, fake);
  await open(page);
  const gym = await readDoc(page, 'gym');
  await seed(page, {
    core: { backupToken: TEST_TOKEN },
    gym: { doc: { ...gym, data: { ...gym.data, proteinLogs: { '2026-11-15': [{ name: 'Whey shake', grams: 25 }, { name: 'Steak', grams: 40 }] } } } },
    fridge: { doc: { schemaVersion: 1, data: { items: [], waste: { used: 3, thrown: 1 }, products: {} }, updatedAt: new Date().toISOString() } },
  });
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect.poll(async () => (await readDoc(page, 'fridge')).schemaVersion).toBe(2);
  expect(fake.commits.length).toBeGreaterThan(0);
  expect(fake.commits[0].message).toMatch(/before migrating fridge/);
  const fridge = (await readDoc(page, 'fridge')).data;
  expect(fridge.waste).toEqual({ used: 3, thrown: 1 });
  await expect.poll(async () => (await readDoc(page, 'fridge')).data.food.log['2026-11-15']?.length).toBe(2);
  expect((await readDoc(page, 'fridge')).data.food.log['2026-11-15'].map((e) => [e.name, e.protein, e.from])).toEqual([['Whey shake', 25, 'gym'], ['Steak', 40, 'gym']]);
  expect((await readDoc(page, 'gym')).data.proteinLogs['2026-11-15']).toHaveLength(2); // the Gym keeps its copy
});
