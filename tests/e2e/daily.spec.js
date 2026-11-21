// Daily checks (0.9.13) at a phone viewport: a tick under "Today" that stays after a reload, its page with the
// history, and renaming it; no app icon and no nav tab of its own.
import { expect, test } from '@playwright/test';

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

test('tick the daily check on the home screen; it stays ticked; history and rename on its page', async ({ page }) => {
  await open(page);
  const check = page.getByTestId('daily-c1');
  await expect(check).toHaveAttribute('aria-pressed', 'false');
  const box = await check.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(48);
  await expect(page.locator('.app-icon[data-app="daily"]')).toHaveCount(0);
  await expect(page.locator('#nav [data-section="daily"]')).toHaveCount(0);

  await check.click();
  await expect(check).toHaveAttribute('aria-pressed', 'true');
  await expect(check).toContainText('Done today');
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.getByTestId('daily-c1')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('daily-page-link').click();
  await expect(page.locator('[data-testid="daily-history-c1"] .daily-day--done')).toHaveCount(1);
  await page.getByTestId('daily-name-c1').fill('Morning walk');
  await page.getByTestId('daily-save-c1').click();
  await expect(page.getByTestId('daily-page-msg')).toHaveText('Saved.');
  await page.locator('#nav [data-section="today"]').click();
  await expect(page.getByTestId('daily-c1')).toContainText('Morning walk');
});
