// (47) Playwright e2e coverage skeleton for all ForgeOS Brain Console panels
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:7777";

// Helper: visit a panel and assert the page title / h1 renders
async function visitPanel(page: any, panel: string, title: string) {
  await page.goto(`${BASE}/#/${panel}`);
  await expect(page.locator("h1")).toContainText(title, { timeout: 15000 });
}

const PANELS: Array<{ route: string; title: string; notes?: string }> = [
  { route: "command",    title: "Command Center" },
  { route: "dashboard",  title: "Console" },
  { route: "governance", title: "Governance" },
  { route: "roles",      title: "Roles" },
  { route: "org",        title: "Org" },
  { route: "timeline",   title: "Timeline" },
  { route: "ledger",     title: "Decision Ledger" },
  { route: "search",     title: "Search" },
  { route: "capture",    title: "Capture Page" },
  { route: "decisions",  title: "Decisions" },
  { route: "missions",   title: "Mission Center" },
  { route: "mcp",        title: "MCP" },
  { route: "vault",      title: "Obsidian Vault Sync" },
  { route: "vaultfile",  title: "Vault", notes: "requires a valid file slug" },
  { route: "embed",      title: "Embeddings" },
  { route: "federation", title: "Federation" },
  { route: "audit",      title: "Audit Trail" },
  { route: "schema",     title: "Schema Pack" },
  { route: "config",     title: "Environment" },
  { route: "projects",   title: "Projects" },
  { route: "wizard",     title: "Setup Wizard" },
  { route: "monitoring", title: "Monitoring" },
  { route: "settings",   title: "Settings" },
  { route: "workflows",  title: "Workflows" },
  { route: "marketplace",title: "Marketplace" },
  { route: "plugins",    title: "Plugins" },
  { route: "webhooks",   title: "Webhooks" },
  { route: "heartbeat",  title: "Agent Heartbeat" },
  { route: "memory",     title: "Memory Pool" },
  { route: "amendments", title: "Amendments" },
  { route: "sacred",     title: "Sacred" },
  { route: "processes",  title: "Processes" },
  { route: "portConflicts", title: "Port Conflicts" },
  { route: "reload",     title: "Reload" },
  { route: "pluginManifest", title: "Plugin Manifest" },
  { route: "poolleague", title: "PoolLeague" },
];

for (const p of PANELS) {
  test(`panel renders: ${p.route} → ${p.title}`, async ({ page }) => {
    await visitPanel(page, p.route, p.title);
    // Ensure the sidebar is present for every panel
    await expect(page.locator(".sidebar")).toBeVisible();
    // Ensure the main content area is populated
    const main = page.locator("#main");
    await expect(main).not.toBeEmpty();
  });
}

test("sidebar navigation jumps to each major panel", async ({ page }) => {
  await page.goto(BASE);
  const major = ["dashboard", "roles", "search", "capture", "missions", "vault", "audit"];
  for (const panel of major) {
    await page.click(`.sidebar a[href="#/${panel}"]`);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
  }
});

test("keyboard shortcut ? opens shortcuts overlay", async ({ page }) => {
  await page.goto(BASE);
  await page.keyboard.press("?");
  await expect(page.locator("#shortcuts-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#shortcuts-overlay")).not.toBeVisible();
});
