// E2E tests for backups and restore. GitHub is never called: every request to api.github.com is
// answered by the in-memory fake (tests/fixtures/fake-github.js) through page.route().
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_TOKEN, createFakeGitHub } from '../fixtures/fake-github.js';
import { buildBackup } from '../../src/core/transfer.js';

// Keep the service worker out of the way, so page.route() sees every request.
test.use({ serviceWorkers: 'block' });

const HOUR = 3600_000;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
};

async function routeGitHub(page, fake) {
  await page.unroute('https://api.github.com/**');
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const res = await fake.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() });
    return route.fulfill({
      status: res.status,
      headers: { ...CORS, 'content-type': res.headers.get('content-type') || 'text/plain' },
      body: await res.text(),
    });
  });
}

async function offlineGitHub(page) {
  await page.unroute('https://api.github.com/**');
  await page.route('https://api.github.com/**', (route) => route.abort('internetdisconnected'));
}

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

/** Writes values into the app's core store, then reloads so the app reads them. */
async function seedCore(page, values) {
  await page.evaluate(async (vals) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('thehub');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction('core', 'readwrite');
    for (const [k, v] of Object.entries(vals)) tx.objectStore('core').put(v, k);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, values);
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const card = (page) => page.locator('[data-module="core-backup"]');

test('never → set up the token in Settings → back up now → ok, and the token stays off the page and out of exports', async ({ page }) => {
  const fake = createFakeGitHub();
  await routeGitHub(page, fake);
  await open(page);
  await expect(card(page)).toHaveAttribute('data-state', 'not-set-up');
  await expect(card(page)).toContainText('Backups: not set up yet');

  await page.getByTestId('backup-setup').click();
  await expect(page.getByTestId('backup-settings')).toBeVisible();
  await expect(page.getByTestId('backup-owner')).toHaveValue('MartinLNoel');
  await expect(page.getByTestId('backup-repo')).toHaveValue('thehub-backup');
  await page.getByTestId('backup-token').fill(TEST_TOKEN);
  await page.getByTestId('backup-expiry').fill('2027-10-17');
  await page.getByTestId('backup-save').click();
  await expect(page.getByTestId('backup-status')).toHaveText('Saved.');
  await expect(page.getByTestId('backup-token-masked')).toHaveText('Token: ••••••••OKEN');
  await expect(page.getByTestId('backup-token')).toHaveValue('');

  await page.getByTestId('backup-test').click();
  await expect(page.getByTestId('backup-status')).toHaveText('Connected to MartinLNoel/thehub-backup ✓');

  await page.locator('#nav [data-section="today"]').click();
  await expect(card(page)).toHaveAttribute('data-state', 'never');
  await expect(card(page)).toContainText('No verified backup yet.');
  await page.getByTestId('backup-now').click();
  await expect(card(page)).toHaveAttribute('data-state', 'ok');
  await expect(card(page)).toContainText(/Last verified backup: just now ✓/);
  expect(fake.commits).toHaveLength(1);
  expect(fake.latest().text).not.toContain(TEST_TOKEN);

  expect(await page.content()).not.toContain(TEST_TOKEN);
  for (const r of fake.requests) {
    expect(new URL(r.url).origin).toBe('https://api.github.com');
    expect(r.url).not.toContain(TEST_TOKEN);
  }

  await page.goto('./#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const exported = readFileSync(await (await downloadPromise).path(), 'utf8');
  expect(exported).not.toContain(TEST_TOKEN);
});

test('amber after 30 hours, and no automatic backup within 10 minutes of the last attempt', async ({ page }) => {
  const fake = createFakeGitHub();
  await routeGitHub(page, fake);
  await open(page);
  await seedCore(page, {
    backupToken: TEST_TOKEN,
    backupStatus: { lastVerifiedBackup: iso(31 * HOUR), lastAutoAttemptAt: iso(60_000) },
    lastExportAt: iso(HOUR),
  });
  await expect(card(page)).toHaveAttribute('data-state', 'amber');
  await expect(card(page)).toContainText('Last verified backup: 31 hours ago');
  await expect(card(page)).not.toContainText('✓');
  await expect(page.getByTestId('export-reminder')).toHaveCount(0);
  expect(fake.commits).toHaveLength(0);
});

test('backs up automatically on start when the last verified backup is over 24 hours old', async ({ page }) => {
  const fake = createFakeGitHub();
  await routeGitHub(page, fake);
  await open(page);
  await seedCore(page, { backupToken: TEST_TOKEN, backupStatus: { lastVerifiedBackup: iso(25 * HOUR) } });
  await expect(card(page)).toHaveAttribute('data-state', 'ok');
  await expect(card(page)).toContainText('✓');
  expect(fake.commits).toHaveLength(1);
  expect(fake.latest().message).toMatch(/automatic/);
});

test('red after 48 hours when the automatic backup fails, with the reason; "Back up now" fixes it', async ({ page }) => {
  const fake = createFakeGitHub();
  await open(page);
  await offlineGitHub(page);
  const soon = new Date(Date.now() + 5 * 24 * HOUR).toISOString().slice(0, 10);
  await seedCore(page, {
    backupToken: TEST_TOKEN,
    backupConfig: { owner: 'MartinLNoel', repo: 'thehub-backup', tokenExpires: soon },
    backupStatus: { lastVerifiedBackup: iso(50 * HOUR) },
  });
  await expect(card(page)).toHaveAttribute('data-state', 'red');
  await expect(page.getByTestId('backup-failure')).toContainText('could not be reached');
  await expect(page.getByTestId('token-warning')).toContainText(/expires in \d+ days/);
  await expect(page.getByTestId('export-reminder')).toBeVisible();
  await expect(page.getByTestId('export-link')).toHaveAttribute('href', '#/settings');

  await routeGitHub(page, fake);
  await page.getByTestId('backup-now').click();
  await expect(card(page)).toHaveAttribute('data-state', 'ok');
  await expect(page.getByTestId('backup-failure')).toHaveCount(0);
  expect(fake.commits).toHaveLength(1);
});

test('restore: pick an older backup from the history, preview, safety backup, replace', async ({ page }) => {
  const fake = createFakeGitHub();
  const old = await buildBackup({
    modules: { demo: { schemaVersion: 1, data: { notes: ['from an old version'] } } },
    appVersion: '0.2.0',
    createdAt: iso(72 * HOUR),
  });
  fake.addCommit(JSON.stringify(old), 'Backup (automatic, app 0.2.0)', iso(72 * HOUR));
  const newer = await buildBackup({
    modules: { demo: { schemaVersion: 2, data: { notes: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] } } },
    appVersion: '0.3.0',
    createdAt: iso(24 * HOUR),
  });
  fake.addCommit(JSON.stringify(newer), 'Backup (automatic, app 0.3.0)', iso(24 * HOUR));
  await routeGitHub(page, fake);

  await open(page);
  await seedCore(page, { backupToken: TEST_TOKEN, backupStatus: { lastVerifiedBackup: iso(HOUR) } });
  await page.goto('./#/demo');
  await page.getByTestId('demo-add').click();
  await page.getByTestId('demo-add').click();
  await expect(page.getByTestId('demo-count')).toHaveText('2 notes');

  await page.goto('./#/settings');
  await page.getByTestId('restore-link').click();
  await expect(page.locator('#title')).toHaveText('Restore');
  const picks = page.getByTestId('restore-pick');
  await expect(picks).toHaveCount(2);
  await expect(picks.first()).toContainText('(latest)');
  await picks.nth(1).click();

  const preview = page.getByTestId('restore-preview');
  await expect(preview).toContainText('It verified ✓');
  await expect(preview).toContainText('Now: notes: 2');
  await expect(preview).toContainText('In backup: notes: 1 (converted from data version 1)');
  await page.getByTestId('restore-confirm').click();
  await expect(page.getByTestId('restore-done')).toBeVisible();

  // The safety backup was taken first and holds the 2 notes from before the restore.
  expect(fake.commits).toHaveLength(3);
  expect(fake.latest().message).toMatch(/before restore/);
  expect(JSON.parse(fake.latest().text).modules.demo.data.notes).toHaveLength(2);

  await page.getByRole('link', { name: 'Go to Today' }).click();
  await expect(page.locator('[data-module="demo"]')).toContainText('1 notes');
});

test('restore refuses a damaged backup', async ({ page }) => {
  const fake = createFakeGitHub();
  const file = await buildBackup({ modules: { demo: { schemaVersion: 2, data: { notes: [] } } }, appVersion: '0.3.0' });
  file.modules.demo.data.notes.push({ text: 'changed afterwards' });
  fake.addCommit(JSON.stringify(file), 'damaged');
  await routeGitHub(page, fake);
  await open(page);
  await seedCore(page, { backupToken: TEST_TOKEN, backupStatus: { lastVerifiedBackup: iso(HOUR) } });
  await page.goto('./#/settings/restore');
  await page.getByTestId('restore-pick').click();
  await expect(page.getByTestId('restore-preview')).toContainText('did not verify');
  await expect(page.getByTestId('restore-preview')).toContainText('Checksum mismatch');
  await expect(page.getByTestId('restore-confirm')).toHaveCount(0);
});
