// E2E tests at a phone viewport, against the test build (the demo module is added by the test
// server; see scripts/serve.mjs).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

async function waitForServiceWorker(page) {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 });
}

test.afterEach(async ({ request }) => {
  await request.get('/__test/sw-version?v=');
});

test('loads at the phone viewport on Today, without sideways scrolling', async ({ page }) => {
  await open(page);
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.locator('#title')).toHaveText('Today');
  expect(page.viewportSize()).toEqual({ width: 412, height: 915 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Today shows the demo module card and the backup placeholder', async ({ page }) => {
  await open(page);
  const card = page.locator('[data-module="demo"]');
  await expect(card).toContainText('Demo');
  await expect(card).toContainText('0 notes');
  await expect(page.locator('[data-module="core-backup"]')).toContainText('Backups: not set up yet');
});

test('the bottom nav and the header move between screens', async ({ page }) => {
  await open(page);
  const tabs = page.locator('#nav .tab');
  await expect(tabs).toHaveText([/Today/, /Gym/, /ISTQB/, /Demo/, /Sample/]);

  await page.locator('#nav [data-section="demo"]').click();
  await expect(page).toHaveURL(/#\/demo$/);
  await expect(page.getByTestId('demo-home')).toBeVisible();
  await expect(page.locator('#nav [data-section="demo"]')).toHaveAttribute('aria-current', 'page');

  await page.getByRole('link', { name: 'Detail' }).click();
  await expect(page.getByTestId('demo-detail')).toBeVisible();

  await page.getByTestId('settings-link').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await expect(page.locator('#title')).toHaveText('Settings');

  await page.locator('#nav [data-section="today"]').click();
  await expect(page.getByTestId('today')).toBeVisible();
});

test('module data is saved and shows on Today after a reload', async ({ page }) => {
  await open(page, '#/demo');
  await page.getByTestId('demo-add').click();
  await page.getByTestId('demo-add').click();
  await expect(page.getByTestId('demo-count')).toHaveText('2 notes');
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await page.locator('#nav [data-section="today"]').click();
  await expect(page.locator('[data-module="demo"]')).toContainText('2 notes');
});

test('shortcut routes: "Scan item" (not built yet) shows "coming soon"; "Study" opens ISTQB; "Log workout" opens the Gym', async ({ page }) => {
  await open(page, '#/fridge/scan');
  await expect(page.getByTestId('coming-soon')).toContainText('coming soon');
  await open(page, '#/istqb');
  await expect(page.getByTestId('study-home')).toHaveAttribute('data-module', 'istqb');
  await open(page, '#/gym/log');
  await expect(page.getByTestId('gym-workout')).toBeVisible();
  await expect(page.getByTestId('gym-log-workout')).toBeVisible();
  await open(page, '#/gym/nothing-here');
  await expect(page.getByTestId('coming-soon')).toContainText('There is no screen');
});

test('touch targets are at least 48 px', async ({ page }) => {
  await open(page, '#/settings');
  const targets = page.locator('#nav .tab, .icon-btn, .btn, .seg');
  const count = await targets.count();
  expect(count).toBeGreaterThan(4);
  for (let i = 0; i < count; i++) {
    const box = await targets.nth(i).boundingBox();
    expect(box.height, await targets.nth(i).textContent()).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
  }
});

test('the theme toggle is stored and survives a reload', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('[data-theme-choice="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('[data-theme-choice="system"]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});

test('export then import restores the data, after a confirmation screen', async ({ page }) => {
  await open(page, '#/demo');
  await page.getByTestId('demo-add').click();
  await expect(page.getByTestId('demo-count')).toHaveText('1 notes');

  await page.goto('./#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^thehub-export-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(exported.format).toBe('thehub-backup');
  expect(exported.modules.demo.data.notes).toHaveLength(1);

  // Change the data, then import the export back.
  await page.goto('./#/demo');
  await page.getByTestId('demo-add').click();
  await expect(page.getByTestId('demo-count')).toHaveText('2 notes');
  await page.goto('./#/settings');
  await page.getByTestId('import-file').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  const confirm = page.getByTestId('import-confirm');
  await expect(confirm).toContainText('Now: notes: 2');
  await expect(confirm).toContainText('From file: notes: 1');
  await page.getByTestId('import-confirm-button').click();
  await expect(page.getByTestId('import-done')).toBeVisible();
  await page.getByRole('link', { name: 'Go to Today' }).click();
  await expect(page.locator('[data-module="demo"]')).toContainText('1 notes');
});

test('a tampered import file is refused', async ({ page }) => {
  await open(page, '#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const exported = JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8'));
  exported.modules.demo.data.notes.push({ text: 'sneaky' });
  await page.getByTestId('import-file').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByTestId('transfer-status')).toContainText('Checksum mismatch');
  await expect(page.getByTestId('import-confirm')).toHaveCount(0);
});

test('the app reloads offline after a first visit', async ({ page, context }) => {
  await open(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.locator('[data-module="demo"]')).toContainText('Demo');
  await page.goto('./#/settings');
  await expect(page.getByTestId('settings')).toBeVisible();
  await context.setOffline(false);
});

test('the update banner appears when a new version is waiting, and tapping it updates', async ({ page, request }) => {
  await open(page);
  await waitForServiceWorker(page);
  await expect(page.locator('#update-banner')).toHaveCount(0);

  // The server now reports a new version of sw.js; ask the browser to check for it.
  await request.get('/__test/sw-version?v=9.9.9');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());

  const banner = page.locator('#update-banner');
  await expect(banner).toHaveText('Update available — tap to refresh', { timeout: 15_000 });

  await Promise.all([page.waitForEvent('load'), banner.click()]);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.locator('#update-banner')).toHaveCount(0);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toEqual(['thehub-9.9.9']);
});
