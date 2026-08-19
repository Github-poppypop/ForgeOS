// Playwright e2e route coverage for the ForgeOS Brain Console.
//
// REWRITTEN 2026-08-19 (driver wave 4): the previous version of this file was a
// skeleton asserting a DOM that does not exist, so all 44 tests failed the
// moment the suite was actually wired up and run:
//   * it asserted a per-panel `<h1>` containing the panel title -- App.tsx has
//     only three <h1> elements in total; panels use <h2>/.section-header,
//   * it asserted a `.sidebar` shell -- the nav rail is `nav.sidenav`,
//   * it asserted a `#main` region -- the real region is `#main-canvas`,
//   * it listed four invented routes (portConflicts, reload, pluginManifest).
//
// Every assertion below is derived from the real shell in
// src/client/src/App.tsx and verified against the running console on :7777.
import { test, expect, type Page } from '@playwright/test';

// Mirrors the ROUTES array in src/client/src/App.tsx.
const ROUTES = [
  '/dashboard',
  '/roles',
  '/search',
  '/capture',
  '/decisions',
  '/timeline',
  '/ledger',
  '/missions',
  '/mcp',
  '/vault',
  '/embed',
  '/federation',
  '/audit',
  '/schema',
  '/config',
  '/command',
  '/compliance',
  '/governance',
  '/monitoring',
  '/workflows',
  '/marketplace',
  '/plugins',
  '/projects',
  '/settings',
  '/poolleague',
  '/webhooks',
  '/apps',
  '/self-improve',
  '/developers',
];

async function expectShell(page: Page, route: string) {
  // The primary nav rail must render on every route.
  await expect(page.locator('nav.sidenav'), `${route}: nav rail`).toBeVisible();

  // The main content region must exist and actually contain rendered content
  // (catches a panel that mounts but renders nothing).
  const main = page.locator('#main-canvas');
  await expect(main, `${route}: main region`).toBeVisible();
  await expect(main, `${route}: main region is populated`).not.toBeEmpty();

  // DebugErrorBoundary must not have caught anything on this route.
  await expect(page.locator('.error-boundary'), `${route}: error boundary`).toHaveCount(0);
}

for (const route of ROUTES) {
  test(`route renders cleanly: ${route}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    const response = await page.goto(route);
    expect(response?.status(), `${route} should be served`).toBeLessThan(400);

    await expectShell(page, route);

    // Clean-path routing (usePathRoute) must mark the visited route active in
    // the rail. Not every route is surfaced in CATEGORIES, so only assert when
    // the link is actually present.
    const link = page.locator(`nav.sidenav a[href="${route}"]`);
    if ((await link.count()) > 0) {
      await expect(link.first(), `${route}: active nav item`).toHaveClass(/active/);
    }

    expect(pageErrors, `uncaught page errors on ${route}`).toEqual([]);
  });
}
