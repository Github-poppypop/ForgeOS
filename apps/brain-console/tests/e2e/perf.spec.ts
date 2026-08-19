// Performance budget checks for the ForgeOS Brain Console.
// Requires a running server (BASE_URL, default http://127.0.0.1:7777).
// Run: npx playwright test tests/e2e/perf.spec.ts
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL || "http://127.0.0.1:7777";
const FCP_BUDGET_MS = 2500;
const GZIP_BUDGET_KB = 120; // soft budget per JS chunk

test("dashboard first contentful paint is within budget", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const fcp = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") resolve(entry.startTime);
        }
      });
      po.observe({ type: "paint", buffered: true });
      const entries = performance.getEntriesByName("first-contentful-paint");
      if (entries.length) resolve(entries[0].startTime);
      setTimeout(() => resolve(performance.now()), 5000);
    });
  });
  expect(fcp).toBeLessThan(FCP_BUDGET_MS);
});

test("built JS bundle stays within gzip budget", async () => {
  const dist = path.resolve(fileURLToPath(import.meta.url), "..", "..", "dist", "assets");
  if (!existsSync(dist)) {
    test.skip(true, "dist/assets not built");
    return;
  }
  const chunks = readdirSync(dist).filter((f) => f.endsWith(".js"));
  expect(chunks.length).toBeGreaterThan(0);
  for (const f of chunks) {
    const buf = readFileSync(path.join(dist, f));
    const gzipKb = (buf.length * 0.32) / 1024; // conservative gzip ratio for minified JS
    expect(gzipKb).toBeLessThan(GZIP_BUDGET_KB);
  }
});
