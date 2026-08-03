// tests/unit/render.spec.ts — unit tests for src/app.js render functions
// Verifies all expected render functions are defined in the SPA source.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

describe("render functions in src/app.js", () => {
  const source = readFileSync("src/app.js", "utf8");

  const expectedFunctions = [
    "renderDashboard",
    "renderRoles",
    "renderPage",
    "renderOrg",
    "renderSearch",
    "renderCapture",
    "renderDecisions",
    "renderTimeline",
    "renderLedger",
    "renderMissions",
    "renderVault",
    "renderAudit",
    "renderSchema",
    "renderConfig",
    "renderCommand",
    "renderGovernance",
    "renderFederation",
    "renderMCP",
    "renderEmbed",
    "renderThemeSwitcher",
    "renderCmdk",
    "renderWizard",
    "renderProjects",
    "renderSettings",
    "renderWorkflows",
    "renderMarketplace",
    "renderPlugins",
  ];

  for (const fn of expectedFunctions) {
    test(`defines ${fn}`, () => {
      expect(source.includes(`function ${fn}(`)).toBe(true);
    });
  }

  test("has route function for navigation", () => {
    expect(source.includes("function route(")).toBe(true);
  });

  test("has shell function for layout", () => {
    expect(source.includes("function shell(")).toBe(true);
  });
})

test("renderWizard exists", () => {
  expect(typeof renderWizard).toBe("function");
});
test("renderProjects exists", () => {
  expect(typeof renderProjects).toBe("function");
});
test("renderSettings exists", () => {
  expect(typeof renderSettings).toBe("function");
});
test("renderWorkflows exists", () => {
  expect(typeof renderWorkflows).toBe("function");
});
test("renderMarketplace exists", () => {
  expect(typeof renderMarketplace).toBe("function");
});
test("renderPlugins exists", () => {
  expect(typeof renderPlugins).toBe("function");
});
test("renderWebhooks exists", () => {
  expect(typeof renderWebhooks).toBe("function");
});
test("renderVault exists", () => {
  expect(typeof renderVault).toBe("function");
});
test("renderAudit exists", () => {
  expect(typeof renderAudit).toBe("function");
});
test("renderMissions exists", () => {
  expect(typeof renderMissions).toBe("function");
});
test("renderGovernance exists", () => {
  expect(typeof renderGovernance).toBe("function");
});
test("renderFederation exists", () => {
  expect(typeof renderFederation).toBe("function");
});
test("renderRoles exists", () => {
  expect(typeof renderRoles).toBe("function");
});
});