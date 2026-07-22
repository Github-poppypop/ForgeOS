// (47) Playwright e2e smoke test for the ForgeOS Brain Console
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:7777";

test("console loads and shows dashboard", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator("h1")).toContainText("Brain Console");
  // brain ok pill present
  await expect(page.locator(".pill.ok")).toBeVisible();
});

test("navigates to Roles and lists 7 C-suite", async ({ page }) => {
  await page.goto(BASE + "/#/roles");
  await expect(page.locator("h1")).toContainText("C-Suite Roles");
  await expect(page.locator(".card")).toHaveCount(7);
});

test("semantic search returns a result", async ({ page }) => {
  await page.goto(BASE + "/#/search");
  await page.fill("#q", "cto");
  await page.click("#go");
  await expect(page.locator("#res .card")).toBeVisible({ timeout: 30000 });
});

test("capture creates a page", async ({ page }) => {
  await page.goto(BASE + "/#/capture");
  await page.fill("#slug", "decisions/e2e-" + Date.now());
  await page.fill("#body", "# E2E\ncreated by test.");
  await page.click("#cap");
  await expect(page.locator("h1.mono")).toBeVisible({ timeout: 30000 });
});
