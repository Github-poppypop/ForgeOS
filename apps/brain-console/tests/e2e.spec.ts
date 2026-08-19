// Playwright smoke test for the ForgeOS Brain Console.
//
// REWRITTEN 2026-08-19 (driver wave 4): the previous version targeted element
// IDs that do not exist anywhere in the client (#q, #go, #res, #slug, #body,
// #cap) and expected per-panel <h1> headings, so all four tests failed as soon
// as the suite was actually wired into CI. These replacements assert the real
// shell and the real clean-path navigation behaviour.
import { test, expect } from '@playwright/test';

test('health endpoint is live', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
});

test('console shell renders on load', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('nav.sidenav')).toBeVisible();
  await expect(page.locator('#main-canvas')).not.toBeEmpty();
  await expect(page.locator('.error-boundary')).toHaveCount(0);
});

test('sidebar navigation uses clean paths and updates the active item', async ({ page }) => {
  await page.goto('/dashboard');

  const rolesLink = page.locator('nav.sidenav a[href="/roles"]');
  await expect(rolesLink).toBeVisible();
  await rolesLink.click();

  // usePathRoute() pushes a clean path -- no '#/' fragment.
  await expect(page).toHaveURL(/\/roles$/);
  await expect(rolesLink).toHaveClass(/active/);
  await expect(page.locator('.error-boundary')).toHaveCount(0);
});

test('navigation filter narrows the rail', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByLabel('Filter navigation').fill('ledger');

  await expect(page.locator('nav.sidenav a[href="/ledger"]')).toBeVisible();
  await expect(page.locator('nav.sidenav a[href="/roles"]')).toHaveCount(0);
});
