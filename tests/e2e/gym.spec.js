// E2E tests for the Gym module at a phone viewport: log a workout, protein (read from the Fridge), check-in, and the
// import from gainz-tracker (with a SYNTHETIC export, never Martin's real file).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const FIXTURE = readFileSync(new URL('../fixtures/gainz-export.synthetic.json', import.meta.url), 'utf8');

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

const gymCard = (page) => page.locator('[data-module="gym"]');

test('Today shows the Gym card with one tap to log', async ({ page }) => {
  await open(page);
  await expect(gymCard(page)).toContainText('Today: Upper A — Push + Pull');
  await expect(gymCard(page)).toContainText('This week: 0/3 sessions');
  await expect(gymCard(page)).toContainText('Protein: enter your weight (Gym → Protein) for a daily target');
  await gymCard(page).getByRole('link', { name: 'Log workout' }).click();
  await expect(page).toHaveURL(/#\/gym\/log$/);
  await expect(page.getByTestId('gym-day')).toHaveText('Upper A');
});

test('log a workout: it shows on Today and in History, and survives a reload', async ({ page }) => {
  await open(page, '#/gym/log');
  await page.getByTestId('set-0-0-weight').fill('40');
  await page.getByTestId('set-0-0-reps').fill('10');
  await page.getByTestId('set-1-0-weight').fill('35');
  await page.getByTestId('set-1-0-reps').fill('12');
  await page.getByTestId('gym-log-workout').click();
  await expect(page.locator('#gym-toast')).toHaveText('WORKOUT SAVED 💪');
  await expect(page.getByTestId('gym-day')).toHaveText('Lower A');
  await expect(page.getByTestId('gym-week')).toContainText('1/3');

  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await page.locator('#nav [data-section="today"]').click();
  await expect(gymCard(page)).toContainText('Done today. Next: Lower A — Quad + Hamstring.');
  await expect(gymCard(page)).toContainText('This week: 1/3 sessions');

  await page.goto('./#/gym/history');
  const entries = page.getByTestId('gym-log-entry');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Upper A');
  await expect(entries.first()).toContainText('Incline Chest Press: 40kg × 10');
  await expect(entries.first()).toContainText('Lat Pulldown: 35kg × 12');
  await expect(page.locator('.gym-pb')).toHaveCount(2);

  // The next Upper A pre-fills from this one; the Today tab of the module is one tap away.
  await page.goto('./#/gym/fighter');
  await expect(page.getByTestId('gym-stage-label')).toHaveText('SEASON 1 · STAGE 1 OF 20');
});

test('an empty workout is not saved', async ({ page }) => {
  await open(page, '#/gym');
  await page.getByTestId('gym-log-workout').click();
  await expect(page.locator('#gym-toast')).toHaveText('LOG SOME WEIGHTS FIRST');
  await page.goto('./#/gym/history');
  await expect(page.getByTestId('gym-history-empty')).toBeVisible();
});

test('Protein is read-only since 0.9.8: enter a weight for the target, food is logged in the Fridge', async ({ page }) => {
  await open(page, '#/gym/protein');
  await expect(page.getByTestId('gym-protein-left')).toHaveText('No target yet: enter your weight above.');
  await page.getByTestId('gym-bodyweight').fill('75');
  await page.getByTestId('gym-bodyweight').blur();
  await expect(page.getByTestId('gym-protein-left')).toHaveText('⚡ 135g remaining');
  await expect(page.getByTestId('gym-protein-total')).toHaveText('0');
  await expect(page.getByTestId('custom-food-add')).toHaveCount(0);
  await page.getByTestId('gym-to-fridge').click();
  await page.getByRole('button', { name: /Whey shake 120 kcal/ }).click();
  await expect(page.getByTestId('food-protein')).toHaveText('25g');
  await page.goto('./#/gym/protein');
  await expect(page.getByTestId('gym-protein-total')).toHaveText('25');
  await expect(page.getByTestId('gym-protein-left')).toHaveText('⚡ 110g remaining');
  await page.locator('#nav [data-section="today"]').click();
  await expect(gymCard(page)).toContainText('Protein: 110g left today');
});

test('complete a check-in: it shows in History and sets the protein target', async ({ page }) => {
  await open(page, '#/gym/checkin');
  await page.getByTestId('ci-weight').fill('77.5');
  await page.getByTestId('ci-cals').fill('2900');
  await page.getByTestId('ci-notes').fill('Felt strong');
  await page.getByTestId('ci-save').click();
  await expect(page.locator('#gym-toast')).toHaveText('CHECK-IN SAVED ✓');
  const entry = page.getByTestId('gym-checkin-entry');
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('77.5kg');
  await expect(entry).toContainText('~2900 kcal/day');
  await expect(entry).toContainText('"Felt strong"');

  await page.locator('#nav [data-section="today"]').click();
  await expect(gymCard(page)).toContainText(`Protein: ${Math.round(77.5 * 1.8)}g left today`);
});

test('import from gainz-tracker: preview, import, and importing again adds nothing', async ({ page }) => {
  await open(page, '#/settings');
  const card = page.locator('[data-importer="gym/gainz-tracker"]');
  await expect(card).toContainText('Import from gainz-tracker');
  await page.getByTestId('import-gym-gainz-tracker').setInputFiles({ name: 'gainz-backup.json', mimeType: 'application/json', buffer: Buffer.from(FIXTURE) });

  const summary = page.getByTestId('module-import-summary');
  await expect(summary).toContainText('In the file: 5 workouts, 2 protein days, 2 check-ins, fighter stage 2 of 20.');
  await expect(page.getByTestId('module-import-confirm')).toContainText('Backups are not set up');
  await page.getByTestId('module-import-apply').click();
  await expect(page.getByTestId('module-import-done')).toBeVisible();

  await page.goto('./#/gym/history');
  await expect(page.getByTestId('gym-log-entry')).toHaveCount(5);
  await page.goto('./#/gym/fighter');
  await expect(page.getByTestId('gym-stage-label')).toHaveText('SEASON 1 · STAGE 2 OF 20');
  await page.goto('./#/gym/checkin');
  await expect(page.getByTestId('gym-checkin-entry')).toHaveCount(2);

  await page.goto('./#/settings');
  await page.getByTestId('import-gym-gainz-tracker').setInputFiles({ name: 'gainz-backup.json', mimeType: 'application/json', buffer: Buffer.from(FIXTURE) });
  await expect(summary).toContainText('Everything in this file is already in TheHub. Nothing to import.');
  await expect(page.getByTestId('module-import-apply')).toHaveCount(0);
  await page.getByTestId('module-import-cancel').click();
  await page.goto('./#/gym/history');
  await expect(page.getByTestId('gym-log-entry')).toHaveCount(5);
});

test('import from gainz-tracker refuses a file that is not a gainz export', async ({ page }) => {
  await open(page, '#/settings');
  await page.getByTestId('import-gym-gainz-tracker').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('[data-importer="gym/gainz-tracker"]')).toContainText('Import refused. This is not a gainz-tracker export');
});

test('gainz-tracker data at the same address is offered without a file', async ({ page }) => {
  await open(page, '#/today');
  await page.evaluate((text) => {
    localStorage.setItem('gainz_state', text);
    localStorage.setItem('gainz_notion_token', 'secret_e2e_never_read');
  }, FIXTURE);
  await page.goto('./#/settings');
  await page.getByTestId('import-gym-gainz-tracker-local').click();
  await expect(page.getByTestId('module-import-summary')).toContainText('5 workouts');
  await page.getByTestId('module-import-apply').click();
  await expect(page.getByTestId('module-import-done')).toBeVisible();
  await page.getByRole('link', { name: 'Open Gym' }).click();
  await expect(page.getByTestId('gym-workout')).toBeVisible();

  await page.goto('./#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const exported = readFileSync(await (await downloadPromise).path(), 'utf8');
  expect(JSON.parse(exported).modules.gym.data.workoutLogs).toHaveLength(5);
  expect(exported).not.toContain('secret_e2e_never_read');
});

test('home plan: switch to it, the figures move, log Day A, and the choice survives a reload', async ({ page }) => {
  await open(page, '#/gym/log');
  await page.getByTestId('program-home').click();
  await expect(page.locator('#gym-toast')).toHaveText('HOME PLAN ON 🏠');
  await expect(page.getByTestId('gym-day')).toHaveText('Day A');
  await expect(page.locator('.gym-ex svg.gym-demo')).toHaveCount(10);
  await expect(page.getByTestId('mode-home')).toHaveCount(0);

  // The curl's forearm moves: its wrist is somewhere else a moment later.
  const wrist = () => page.locator('svg[data-demo="curl"] .gym-demo__body line').nth(2).getAttribute('x2');
  const first = await wrist();
  await expect.poll(wrist, { timeout: 3000 }).not.toBe(first);

  await page.getByTestId('set-0-0-reps').fill('8');
  await page.getByTestId('gym-log-workout').click();
  await expect(page.locator('#gym-toast')).toHaveText('WORKOUT SAVED 💪');
  await expect(page.getByTestId('gym-day')).toHaveText('Day B');

  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.getByTestId('program-home')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#nav [data-section="today"]').click();
  await expect(gymCard(page)).toContainText('Done today. Next: Day B — Shoulders + width.');
});

test('home plan: fits the phone width and its links and buttons are 48 px', async ({ page }) => {
  await open(page, '#/gym/log');
  await page.getByTestId('program-home').click();
  await expect(page.getByTestId('gym-day')).toHaveText('Day A');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const targets = page.locator('#screen .btn, #screen .seg, #screen .gym-ex__video, #screen .gym-wd');
  const count = await targets.count();
  expect(count).toBeGreaterThan(9);
  for (let i = 0; i < count; i++) {
    const box = await targets.nth(i).boundingBox();
    expect(box.height, await targets.nth(i).textContent()).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({ path: 'test-results/home-plan.png', fullPage: true });
});

// A fake Open-Meteo: the tests never reach the real weather service. "Testville" is made up.
async function fakeWeather(page, code) {
  await page.route('https://geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({ json: { results: [{ name: 'Testville', admin1: 'North', country: 'Nowhere', latitude: 10.5, longitude: 20.25 }] } }),
  );
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: { current: { weather_code: code, is_day: 1, temperature_2m: -1 } } }));
}

test('the Fighter draws the story scene, with its chapter, and moves', async ({ page }) => {
  await open(page, '#/gym/fighter');
  const scene = page.locator('canvas.gym-story');
  await expect(scene).toHaveAttribute('data-stage', '1');
  await expect(page.getByTestId('gym-chapter')).toContainText('Chapter 1');
  const drawn = () => scene.evaluate((cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let filled = 0;
    let sum = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) filled++;
    for (let i = 0; i < d.length; i += 97) sum += d[i];
    return { filled, sum };
  });
  const first = await drawn();
  expect(first.filled).toBe(160 * 120); // every pixel painted
  await expect.poll(async () => (await drawn()).sum, { timeout: 3000 }).not.toBe(first.sum); // rain falls
  // the next stage is locked: no scene, no story
  await page.getByRole('button', { name: 'Next stage' }).click();
  await expect(page.getByTestId('gym-story-locked')).toContainText('Unlocks at 3 sessions');
  await expect(page.locator('canvas.gym-story')).toHaveCount(0);
});

test('Settings → Weather: find a town; the home screen shows its weather and the story uses it', async ({ page }) => {
  await fakeWeather(page, 73); // snow
  await open(page, '#/settings');
  const card = page.getByTestId('weather-card');
  await expect(card).toContainText('No town set');
  await page.getByTestId('weather-town-input').fill('Testville');
  await page.getByTestId('weather-search').click();
  await card.getByRole('button', { name: 'Testville, North, Nowhere' }).click();
  await expect(page.getByTestId('weather-status')).toHaveText('Saved. The home screen and the story now follow the weather in Testville.');

  await page.goto('./#/');
  await expect(page.getByTestId('home-status-gym')).toHaveText('🌨️ Snow, -1°C · Testville');
  await page.goto('./#/gym/fighter');
  await expect(page.getByTestId('gym-weather')).toHaveCount(0);
  await expect(page.locator('canvas.gym-story')).toHaveAttribute('data-weather', /overcast snow/);

  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await page.goto('./#/settings');
  await expect(page.getByTestId('weather-town')).toHaveText('Town: Testville, North, Nowhere');
});

test('the Today card has a quote of the day', async ({ page }) => {
  await open(page);
  await expect(gymCard(page)).toContainText('💬 \u201c');
});

test('every Gym screen fits the phone width and has 48 px touch targets', async ({ page }) => {
  for (const hash of ['#/gym', '#/gym/history', '#/gym/fighter', '#/gym/protein', '#/gym/checkin']) {
    await open(page, hash);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, hash).toBeLessThanOrEqual(0);
    const targets = page.locator('#screen .btn, #screen .seg, #screen .gym-tab, #screen .gym-chip, #screen .gym-stage, #screen .gym-arrow, #screen .gym-x');
    const count = await targets.count();
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      if (!box) continue; // hidden (e.g. the closed "add food" form)
      expect(box.height, `${hash}: ${await targets.nth(i).textContent()}`).toBeGreaterThanOrEqual(48);
    }
  }
});
