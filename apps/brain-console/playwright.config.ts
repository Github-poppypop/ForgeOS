// Playwright configuration for the ForgeOS Brain Console e2e suite.
//
// Why this file exists: the e2e specs and the `npm run e2e` / `npm run perf`
// scripts predated any config, so `npx playwright test` ran with Playwright's
// defaults -- no baseURL, no webServer, and a testDir of the repo root. That
// made the suite effectively un-runnable in CI (nothing ever started the
// console), which is why the backlog item "Playwright tests actually exercised
// in CI" stayed open even though the specs existed.
//
// The `webServer` block is the important part: it boots `npx tsx server.ts`
// and waits on /api/health before the first spec runs, so CI no longer needs a
// hand-rolled "start server && sleep" step.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 7777);
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Locally (and on the VPS, where PM2 already serves :7777) reuse whatever is
// already listening so we never kill the production listener. In CI there is
// nothing running, so Playwright owns the lifecycle.
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e.spec.ts', 'e2e/**/*.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // The console is a single shared server with in-memory state; running specs
  // in parallel makes the governance/capture assertions flaky.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx server.ts',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PORT: String(PORT), NODE_ENV: 'production' },
  },
});
