import { defineConfig } from '@playwright/test';

const PORT = 4174;

export default defineConfig({
  testDir: 'tests/e2e',
  // The update test changes what the shared test server answers for sw.js, so run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // On GitHub, failures also become annotations on the run, readable without a login (the logs are not).
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/TheHub/`,
    // A Galaxy S-series sized phone in portrait.
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'phone-chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://localhost:${PORT}/TheHub/`,
    env: { THEHUB_TEST: '1', PORT: String(PORT) },
    reuseExistingServer: false,
  },
});
