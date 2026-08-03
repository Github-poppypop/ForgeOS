// tests/unit/render.spec.ts - verifies render* functions are defined in app.js
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const appSrc = readFileSync("src/app.js", "utf8");

describe("render functions", () => {
  const functions = [
    "renderDashboard", "renderGovernance", "renderVault", "renderAudit",
    "renderMissions", "renderSearch", "renderTimeline", "renderLedger",
    "renderOrg", "renderRoles", "renderFederation", "renderSchema",
    "renderWizard", "renderProjects", "renderSettings", "renderWorkflows",
    "renderMarketplace", "renderPlugins", "renderStats"
  ];

  for (const fn of functions) {
    test(`${fn} exists`, () => {
      expect(appSrc.includes(`async function ${fn}`) || appSrc.includes(`function ${fn}`) || appSrc.includes(`const ${fn}`)).toBe(true);
    });
  }
});
