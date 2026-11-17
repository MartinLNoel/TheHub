// The companion pet (0.9.12) at a phone viewport: an egg on the home screen, a workout hatches it, a tap makes it
// react, its page shows its meals and lets Martin rename it; no app icon and no nav tab of its own.
import { expect, test } from '@playwright/test';

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

test('an egg until the first meal; a workout hatches it; tap it; its page; no icon or nav tab', async ({ page }) => {
  await open(page);
  const widget = page.getByTestId('pet-widget');
  await expect(widget.getByTestId('pet-canvas')).toHaveAttribute('data-stage', 'egg');
  await expect(page.locator('.app-icon[data-app="pet"]')).toHaveCount(0);
  await expect(page.locator('#nav [data-section="pet"]')).toHaveCount(0);

  await page.goto('./#/gym/log');
  await page.getByTestId('set-0-0-reps').fill('8');
  await page.getByTestId('gym-log-workout').click();
  await expect(page.locator('#gym-toast')).toContainText('WORKOUT');
  await page.locator('#nav [data-section="today"]').click();
  await expect(widget.getByTestId('pet-canvas')).toHaveAttribute('data-stage', 'baby');
  await expect(widget.getByTestId('pet-say')).toHaveText('It hatched! Yum: a workout.');
  await widget.getByTestId('pet-canvas').click();
  await expect(widget.getByTestId('pet-say')).not.toHaveText('It hatched! Yum: a workout.');

  await widget.getByTestId('pet-name').click();
  await expect(page.getByTestId('pet-page')).toContainText('A workout1');
  await page.getByTestId('pet-rename').fill('Mos');
  await page.getByTestId('pet-rename-save').click();
  await expect(page.getByTestId('pet-title')).toHaveText('Mos');
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.getByTestId('pet-title')).toHaveText('Mos');
});
