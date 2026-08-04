// tests/unit/ui.spec.ts - verifies new UI/UX features exist in app.js
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const appSrc = readFileSync("src/app.js", "utf8");
const css = readFileSync("src/styles/design.css", "utf8");

describe("new UI features", () => {
  test("has keyboard shortcuts system", () => {
    expect(appSrc.includes("showShortcuts")).toBe(true);
    expect(appSrc.includes("bindShortcuts")).toBe(true);
    expect(appSrc.includes('key === "?"')).toBe(true);
    expect(appSrc.includes('key === "Escape"')).toBe(true);
  });

  test("has theme application helpers", () => {
    expect(appSrc.includes("applyTheme")).toBe(true);
    expect(appSrc.includes("applyContrast")).toBe(true);
    expect(appSrc.includes("localStorage.setItem(\"forgeos-theme\"")).toBe(true);
    expect(appSrc.includes("localStorage.setItem(\"forgeos-font-size\"")).toBe(true);
    expect(appSrc.includes("localStorage.setItem(\"forgeos-contrast\"")).toBe(true);
  });

  test("dashboard has health card", () => {
    expect(appSrc.includes("health-card")).toBe(true);
    expect(appSrc.includes("/api/health/detailed")).toBe(true);
    expect(appSrc.includes("refreshHealth")).toBe(true);
  });

  test("print styles exist", () => {
    expect(css.includes("@media print")).toBe(true);
    expect(css.includes("break-inside: avoid")).toBe(true);
  });

  test("settings has font size control", () => {
    expect(appSrc.includes("s-font")).toBe(true);
    expect(appSrc.includes("--base-font-size")).toBe(true);
  });

  test("settings has contrast control", () => {
    expect(appSrc.includes("s-contrast")).toBe(true);
    expect(appSrc.includes("contrast-default")).toBe(true);
  });

  test("settings has multi-theme selector", () => {
    expect(appSrc.includes("matrix")).toBe(true);
    expect(appSrc.includes("ocean")).toBe(true);
    expect(appSrc.includes("retro")).toBe(true);
  });
});
