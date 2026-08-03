// tests/unit/api-new.spec.ts — contract checks aligned to the current server.ts surface
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

describe("server.ts contract", () => {
  const server = readFileSync("server.ts", "utf8");

  test("serves SPA without a build step", () => {
    expect(server.includes('Bun.file(`${PUBLIC}/index.html`)')).toBe(true);
    expect(server.includes("serveStatic(pathname: string)")).toBe(true);
    expect(server.includes("bun build")).toBe(false);
  });

  test("static assets use no-cache + security headers", () => {
    expect(server.includes('"cache-control": "no-cache"')).toBe(true);
    expect(server.includes('"x-content-type-options": "nosniff"')).toBe(true);
    expect(server.includes('"x-frame-options": "DENY"')).toBe(true);
    expect(server.includes("SPA fallback")).toBe(true);
  });

  test("has auth gate with Bearer token support", () => {
    expect(server.includes("const CONSOLE_TOKEN")).toBe(true);
    expect(server.includes("Bearer")).toBe(true);
    expect(server.includes('error: "unauthorized"')).toBe(true);
  });

  test("has rate limiting with exposed headers", () => {
    expect(server.includes("const RATE")).toBe(true);
    expect(server.includes("function rateOk")).toBe(true);
    expect(server.includes("x-ratelimit-limit")).toBe(true);
    expect(server.includes("x-ratelimit-remaining")).toBe(true);
  });

  test("has core API routes", () => {
    expect(server.includes("/api/health")).toBe(true);
    expect(server.includes("/api/status")).toBe(true);
    expect(server.includes("/api/governance")).toBe(true);
    expect(server.includes("/api/capture")).toBe(true);
    expect(server.includes("/api/page/")).toBe(true);
    expect(server.includes("/api/metrics")).toBe(true);
    expect(server.includes("/api/health/stream")).toBe(true);
  });

  test("has backup endpoint", () => {
    expect(server.includes("/api/backup")).toBe(true);
    expect(server.includes("forgeos-brain.json.gz")).toBe(true);
  });

  test("has SSE stream infrastructure", () => {
    expect(server.includes("WritableStreamDefaultWriter")).toBe(true);
    expect(server.includes("text/event-stream")).toBe(true);
  });
});
