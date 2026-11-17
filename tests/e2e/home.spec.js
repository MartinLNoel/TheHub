// The phone-style home screen at a phone viewport: open an app from its icon, come back with "‹ Home".
import { expect, test } from '@playwright/test';

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

test('home: tap an app icon to open it, "‹ Home" brings you back', async ({ page }) => {
  await open(page);
  await expect(page.locator('body')).toHaveClass(/is-home/);
  await expect(page.getByTestId('home-link')).toBeHidden(); // no back button on the home screen itself
  const apps = page.getByTestId('home-apps').locator('.app-icon');
  await expect(apps.last()).toHaveText('⚙️Settings');

  await page.locator('.app-icon[data-app="gym"]').click();
  await expect(page).toHaveURL(/#\/gym$/);
  await expect(page.locator('#title')).toHaveText('Gym');
  await expect(page.locator('body')).not.toHaveClass(/is-home/);

  await page.getByTestId('home-link').click();
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.getByTestId('today')).toBeVisible();
});

test('home: fits the phone width and every app icon is easy to tap', async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const tiles = page.locator('.app-icon__tile');
  const n = await tiles.count();
  expect(n).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < n; i++) {
    const box = await tiles.nth(i).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
  }
});

test('the "today" strip: a tile per app, a word of the day once loaded, and the market session clock', async ({ page }) => {
  await open(page);
  const strip = page.getByTestId('home-strip');
  await expect(strip.locator('.home-tile')).toHaveCount(4);
  await expect(page.getByTestId('home-tile-gym')).toContainText('0/3 this week');
  await expect(page.getByTestId('home-tile-istqb')).toContainText('Session 1 next');
  await expect(page.getByTestId('home-tile-fridge')).toContainText('kcal today');
  await expect(page.getByTestId('home-tile-bulgarian').locator('.home-tile__sub')).not.toHaveText('loading…'); // the reading words load
  await expect(page.getByTestId('markets').locator('.markets__row')).toHaveCount(3);
  await page.getByTestId('home-tile-fridge').click();
  await expect(page).toHaveURL(/#\/fridge(\/food)?$/);
});
