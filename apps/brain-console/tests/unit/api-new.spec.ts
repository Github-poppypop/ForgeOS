// tests/unit/api-new.spec.ts — source-level checks for Phase 6-11 features
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

describe("Phase 6-10 server routes", () => {
  const server = readFileSync("server.ts", "utf8");

  test("has JWT auth constants", () => {
    expect(server.includes("const JWT_SECRET")).toBe(true);
    expect(server.includes("const JWT_EXPIRY")).toBe(true);
  });

  test("has auth middleware", () => {
    expect(server.includes("async function authenticate")).toBe(true);
    expect(server.includes("/api/auth/login")).toBe(true);
  });

  test("has state persistence", () => {
    expect(server.includes("/api/state")).toBe(true);
  });

  test("has backup/restore", () => {
    expect(server.includes("/api/backup")).toBe(true);
    expect(server.includes("/api/restore")).toBe(true);
  });

  test("has metrics endpoint", () => {
    expect(server.includes("/api/metrics")).toBe(true);
  });

  test("has webhook system", () => {
    expect(server.includes("webhookStore")).toBe(true);
    expect(server.includes("dispatchWebhook")).toBe(true);
  });

  test("has agent workflows", () => {
    expect(server.includes("/api/agent/workflows")).toBe(true);
  });

  test("has agent messaging", () => {
    expect(server.includes("/api/agent/message")).toBe(true);
    expect(server.includes("/api/agent/messages")).toBe(true);
  });

  test("has agent metrics", () => {
    expect(server.includes("/api/agent/metrics")).toBe(true);
  });

  test("has agent marketplace", () => {
    expect(server.includes("/api/agent/marketplace")).toBe(true);
  });

  test("has plugin system", () => {
    expect(server.includes("pluginsDir")).toBe(true);
    expect(server.includes("loadedPlugins")).toBe(true);
  });

  test("has cross-brain federation", () => {
    expect(server.includes("/api/federation")).toBe(true);
    expect(server.includes("remoteBrains")).toBe(true);
  });

  test("has API versioning", () => {
    expect(server.includes("API_VERSION")).toBe(true);
    expect(server.includes("handleVersionedRoute")).toBe(true);
  });
});

describe("Phase 11 UI", () => {
  const app = readFileSync("src/app.js", "utf8");

  test("has setup wizard", () => {
    expect(app.includes("async function renderWizard")).toBe(true);
    expect(app.includes("forgeos-wizard-done")).toBe(true);
  });

  test("has project management", () => {
    expect(app.includes("async function renderProjects")).toBe(true);
    expect(app.includes("forgeos-work-items")).toBe(true);
  });

  test("has settings panel", () => {
    expect(app.includes("async function renderSettings")).toBe(true);
    expect(app.includes("forgeos-theme")).toBe(true);
  });

  test("has workflows panel", () => {
    expect(app.includes("async function renderWorkflows")).toBe(true);
  });

  test("has marketplace panel", () => {
    expect(app.includes("async function renderMarketplace")).toBe(true);
  });

  test("has plugins panel", () => {
    expect(app.includes("async function renderPlugins")).toBe(true);
  });

  test("has notification system", () => {
    expect(app.includes("function notify")).toBe(true);
    expect(app.includes("forgeos-notifications")).toBe(true);
  });

  test("has work item templates", () => {
    expect(app.includes("WORK_ITEM_TEMPLATES")).toBe(true);
  });

  test("has burndown chart", () => {
    expect(app.includes("Burndown")).toBe(true);
  });

  test("new routes are in NAV and routes map", () => {
    expect(app.includes('["Projects", tooltip("Projects", "Project management and kanban"), "projects"]')).toBe(true);
    expect(app.includes('["Wizard", tooltip("Wizard", "Setup wizard for first-time config"), "wizard"]')).toBe(true);
    expect(app.includes('["Settings", tooltip("Settings", "Console settings and configuration"), "settings"]')).toBe(true);
    expect(app.includes('["Workflows", tooltip("Workflows", "Agent workflow management"), "workflows"]')).toBe(true);
    expect(app.includes('["Marketplace", tooltip("Marketplace", "Browse discoverable agents"), "marketplace"]')).toBe(true);
    expect(app.includes('["Plugins", tooltip("Plugins", "Manage console plugins"), "plugins"]')).toBe(true);
    expect(app.includes("projects: renderProjects")).toBe(true);
    expect(app.includes("wizard: renderWizard")).toBe(true);
  });
});
