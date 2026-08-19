// (47) Playwright e2e smoke test for the ForgeOS Brain Console
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:7777";

test("console loads and shows dashboard", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator("h1")).toContainText("Command Center");
  await expect(page.locator(".pill.ok").first()).toBeVisible();
});

test("navigates to Roles and lists 7 C-suite", async ({ page }) => {
  await page.goto(BASE + "/roles");
  await expect(page.locator("h1")).toContainText("Roles");
  await expect(page.locator(".card")).toHaveCount(7);
});

test("semantic search returns a result", async ({ page }) => {
  await page.goto(BASE + "/search");
  await page.fill("#q", "cto");
  await page.click("#go");
  await expect(page.locator("#res")).toContainText("decisions/", { timeout: 30000 });
});

test("capture submits without crashing", async ({ page }) => {
  await page.goto(BASE + "/capture");
  await page.fill("#slug", "decisions/e2e-" + Date.now());
  await page.fill("#body", "# E2E\ncreated by test.");
  await page.click("#cap");
  await expect(page.locator("h1")).toContainText("Capture Page", { timeout: 30000 });
});
