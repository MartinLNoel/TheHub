// E2E tests for the Fridge module at a phone viewport. The camera is faked (a canvas stream showing a
// drawn EAN-13), the phone's BarcodeDetector is faked or removed, and Open Food Facts is ALWAYS mocked or
// blocked: no test ever reaches the real service.
import { expect, test } from '@playwright/test';

const OFF = 'https://world.openfoodfacts.org/**';
const CODE = '5449000000996';
const CORS = { 'access-control-allow-origin': '*' };

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

const found = (name, brands = 'Test Brand, Other') => ({
  status: 200,
  contentType: 'application/json',
  headers: CORS,
  body: JSON.stringify({ status: 1, code: CODE, product: { product_name: name, brands } }),
});

/**
 * Runs in the page before the app: getUserMedia returns a canvas stream showing `code` as a real EAN-13
 * barcode; with `native`, a fake BarcodeDetector "reads" it on its third frame; without, the browser has
 * no BarcodeDetector, so the app's vendored reader (zxing-wasm) must decode the drawn bars itself.
 */
function fakeCamera({ code, native }) {
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const R = L.map((p) => [...p].map((b) => (b === '0' ? '1' : '0')).join(''));
  const G = R.map((p) => [...p].reverse().join(''));
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const d = [...code].map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  const m = 4;
  const x0 = Math.floor((canvas.width - bits.length * m) / 2);
  let n = 0;
  const draw = () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let i = 0; i < bits.length; i++) if (bits[i] === '1') ctx.fillRect(x0 + i * m, 140, m, 200);
    ctx.fillRect(0, 0, 1 + (n++ % 2), 1); // a changing corner pixel keeps frames coming
  };
  window.__cameraRequests = 0;
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__cameraRequests += 1;
    window.__cameraConstraints = constraints;
    draw();
    setInterval(draw, 100);
    window.__stream = canvas.captureStream(10);
    return window.__stream;
  };
  if (native) {
    window.BarcodeDetector = class {
      static async getSupportedFormats() {
        return ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'];
      }
      constructor() {
        this.calls = 0;
      }
      async detect() {
        this.calls += 1;
        return this.calls > 2 ? [{ rawValue: code, format: 'ean_13' }] : [];
      }
    };
  } else {
    delete window.BarcodeDetector;
  }
}

test.beforeEach(async ({ context }) => {
  // Safety net: anything not mocked by a test never reaches Open Food Facts.
  await context.route(OFF, (route) => route.abort('blockedbyclient'));
});

test.describe('with page.route mocks', () => {
  // Keep the service worker out of the way, so page.route() sees every request.
  test.use({ serviceWorkers: 'block' });

  test.describe('at 00:30 in Amsterdam (the UTC date is still the day before)', () => {
    test.use({ timezoneId: 'Europe/Amsterdam' });

    test('add by manual entry; it appears on Today when it expires soon; mark it used', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-17T22:30:00Z'));
      await open(page, '#/fridge');
      await expect(page.getByTestId('fridge-empty')).toBeVisible();

      await page.getByTestId('fridge-add').click();
      await page.getByTestId('fridge-name').fill('Milk');
      await page.getByTestId('fridge-qty').fill('1 L');
      await page.getByTestId('fridge-exp-plus-0').click();
      await expect(page.getByTestId('fridge-expiry')).toHaveValue('2026-10-18');
      await page.getByTestId('fridge-save').click();
      await page.getByTestId('fridge-bg-skip').click(); // the Bulgarian module now asks for the word (Part 7)
      await expect(page.getByTestId('fridge-flash')).toHaveText('Added Milk.');
      await expect(page.getByTestId('fridge-item')).toHaveCount(1);
      await expect(page.getByTestId('fridge-item').first()).toContainText('Expires today');

      await page.getByTestId('fridge-add').click();
      await page.getByTestId('fridge-name').fill('Rice');
      await page.getByTestId('fridge-place-pantry').click();
      await page.getByTestId('fridge-expiry').fill('2026-12-01');
      await page.getByTestId('fridge-save').click();
      await page.getByTestId('fridge-bg-skip').click(); // the Bulgarian module now asks for the word (Part 7)
      await expect(page.getByTestId('fridge-item')).toHaveCount(2);
      await expect(page.getByTestId('fridge-item').nth(1)).toContainText('Expires 01-12-2026');

      await page.reload();
      await expect(page.locator('html[data-ready="true"]')).toBeAttached();
      await page.locator('#nav [data-section="today"]').click();
      const card = page.locator('[data-module="fridge"]');
      await expect(card).toContainText('Fridge: 1 expiring soon');
      await expect(card).toContainText('Milk: expires today');
      await expect(card).not.toContainText('Rice');
      await card.getByRole('link', { name: 'Open Fridge' }).click();
      await expect(page).toHaveURL(/#\/fridge$/);

      await page.getByTestId('fridge-item').first().click();
      await page.getByTestId('fridge-used').click();
      await expect(page.getByTestId('fridge-flash')).toHaveText('Milk: used up.');
      await expect(page.getByTestId('fridge-waste')).toHaveText('Used up: 1 · Thrown away: 0');
      await page.locator('#nav [data-section="today"]').click();
      await expect(card).toContainText('Nothing expires in the next 2 days (1 item stored).');
    });
  });

  test('scan with a mocked camera and detector: Open Food Facts (mocked) prefills the name', async ({ page }) => {
    await page.addInitScript(fakeCamera, { code: CODE, native: true });
    const offRequests = [];
    await page.route(OFF, (route) => {
      offRequests.push(route.request().url());
      return route.fulfill(found('Test Cola'));
    });
    await open(page, '#/fridge');
    expect(await page.evaluate(() => window.__cameraRequests)).toBe(0); // not asked before the scan screen

    await page.getByTestId('fridge-scan').click();
    await expect(page).toHaveURL(new RegExp(`#/fridge/add/${CODE}$`));
    await expect(page.getByTestId('fridge-name')).toHaveValue('Test Cola');
    await expect(page.getByTestId('fridge-brand')).toHaveValue('Test Brand');
    await expect(page.getByTestId('fridge-lookup')).toContainText('Found on Open Food Facts');
    expect(await page.evaluate(() => window.__cameraRequests)).toBe(1);
    expect(await page.evaluate(() => window.__cameraConstraints)).toEqual({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    expect(await page.evaluate(() => window.__stream.getTracks().every((t) => t.readyState === 'ended'))).toBe(true); // camera released
    expect(offRequests).toHaveLength(1);
    const url = new URL(offRequests[0]);
    expect(url.pathname).toBe(`/api/v2/product/${CODE}`);
    expect(url.searchParams.get('app_name')).toBe('TheHub');

    await page.getByTestId('fridge-exp-plus-7').click();
    await page.getByTestId('fridge-save').click();
    await page.getByTestId('fridge-bg-skip').click(); // the Bulgarian module now asks for the word (Part 7)
    await expect(page.getByTestId('fridge-flash')).toHaveText('Added Test Cola.');
    await expect(page.getByTestId('fridge-item').first()).toContainText('Test Cola');
    await expect(page.getByTestId('fridge-item').first()).toContainText('Expires in 7 days');

    // The same product again: filled in from the cache, no second request.
    await page.getByTestId('fridge-scan').click();
    await expect(page).toHaveURL(new RegExp(`#/fridge/add/${CODE}$`));
    await expect(page.getByTestId('fridge-name')).toHaveValue('Test Cola');
    await expect(page.getByTestId('fridge-lookup')).toContainText('earlier lookup');
    expect(offRequests).toHaveLength(1);
  });

  test("fallback scanner (TheHub's vendored zxing) reads an EAN-13 from the camera; offline scan is queued, then looked up", async ({ page }) => {
    await page.addInitScript(fakeCamera, { code: CODE, native: false });
    let calls = 0;
    await page.route(OFF, (route) => {
      calls += 1;
      return route.abort('internetdisconnected');
    });
    await open(page, '#/fridge/scan');
    await expect(page.getByTestId('scan-kind')).toContainText("TheHub's built-in reader", { timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`#/fridge/add/${CODE}$`), { timeout: 20_000 });
    await expect(page.getByTestId('fridge-lookup')).toContainText('looks the barcode up later');

    await page.getByTestId('fridge-save').click(); // no name needed while the lookup waits
    await page.getByTestId('fridge-bg-skip').click(); // the Bulgarian module now asks for the word (Part 7)
    await expect(page.getByTestId('fridge-flash')).toHaveText(`Added Barcode ${CODE}. Its barcode is looked up when you are online.`);
    await expect(page.getByTestId('fridge-pending')).toContainText('1 scanned item still to look up');
    await expect(page.getByTestId('fridge-item').first()).toContainText('lookup waiting');
    await expect.poll(() => calls).toBe(2); // the add screen, then the home screen's automatic try

    // Back online: "Look up now" fills the name in.
    await page.unroute(OFF);
    await page.route(OFF, (route) => route.fulfill(found('Test Cola')));
    await page.getByTestId('fridge-lookup-now').click();
    await expect(page.getByTestId('fridge-flash')).toHaveText('Looked up 1 barcode.');
    await expect(page.getByTestId('fridge-pending')).toHaveCount(0);
    await expect(page.getByTestId('fridge-item').first()).toContainText('Test Cola');
    await expect(page.getByTestId('fridge-item').first()).not.toContainText('lookup waiting');
  });

  test('a refused camera shows a clear message and manual entry still works', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Permission denied', 'NotAllowedError');
      };
    });
    await page.route(OFF, (route) => route.fulfill({ status: 404, contentType: 'application/json', headers: CORS, body: '{"status":0}' }));
    await open(page, '#/fridge/scan');
    await expect(page.getByTestId('scan-problem')).toContainText('Camera access was refused');
    await expect(page.getByTestId('scan-manual')).toBeVisible();
    await page.getByTestId('scan-code').fill('5449000000995');
    await page.getByTestId('scan-code-go').click();
    await expect(page.getByTestId('scan-code-problem')).toContainText('not a valid');
    await page.getByTestId('scan-code').fill(CODE);
    await page.getByTestId('scan-code-go').click();
    await expect(page).toHaveURL(new RegExp(`#/fridge/add/${CODE}$`));
    await expect(page.getByTestId('fridge-lookup')).toContainText('Not on Open Food Facts');
    await page.getByTestId('fridge-name').fill('Cola');
    await page.getByTestId('fridge-save').click();
    await page.getByTestId('fridge-bg-skip').click(); // the Bulgarian module now asks for the word (Part 7)
    await expect(page.getByTestId('fridge-flash')).toHaveText('Added Cola.');
  });

  test('Fridge touch targets are at least 48 px, and Settings shows the barcode diagnostics', async ({ page }) => {
    await open(page, '#/fridge/add');
    const targets = page.locator('#screen .btn, #screen .seg');
    const count = await targets.count();
    expect(count).toBeGreaterThan(8);
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      expect(box.height, await targets.nth(i).textContent()).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThanOrEqual(48);
    }
    await open(page, '#/settings');
    await expect(page.getByTestId('diag-barcode')).toHaveText(/^BarcodeDetector/);
    await expect(page.getByTestId('diag-barcode')).not.toHaveText('BarcodeDetector: checking…');
  });
});

test.describe('offline, from the service worker cache', () => {
  test.use({ serviceWorkers: 'allow' });

  test('the built-in scanner works with no network, and the scan is queued', async ({ page, context }) => {
    await page.addInitScript(fakeCamera, { code: CODE, native: false });
    await open(page);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 });
    await context.setOffline(true);
    await page.goto('./#/fridge/scan');
    await expect(page).toHaveURL(new RegExp(`#/fridge/add/${CODE}$`), { timeout: 20_000 });
    await expect(page.getByTestId('fridge-lookup')).toContainText('Offline');
    await page.getByTestId('fridge-save').click();
    await page.getByTestId('fridge-bg-skip').click(); // the Bulgarian module now asks for the word (Part 7)
    await expect(page.getByTestId('fridge-pending')).toContainText('1 scanned item still to look up');
    // Stays offline to the end, so nothing tries Open Food Facts.
  });
});
