/**
 * src/server/__tests__/missionsched.test.ts — Real unit tests for the mission
 * scheduler's pure scheduling logic (computeNextRun). No server needed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextRun, type Schedule } from "../features/feat-missionsched.js";

function baseSched(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    name: "test",
    intervalSec: 30,
    target: "https://example.com/run",
    enabled: true,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

test("computeNextRun adds intervalSec seconds to from", () => {
  const from = Date.parse("2026-01-01T00:00:00.000Z");
  const next = computeNextRun(baseSched({ intervalSec: 30 }), from);
  assert.equal(next, "2026-01-01T00:00:30.000Z");
});

test("computeNextRun falls back to 60s when interval is invalid/zero/negative", () => {
  const from = Date.parse("2026-01-01T00:00:00.000Z");
  // missing intervalSec
  assert.equal(computeNextRun(baseSched({ intervalSec: undefined as unknown as number }), from), "2026-01-01T00:01:00.000Z");
  // zero
  assert.equal(computeNextRun(baseSched({ intervalSec: 0 }), from), "2026-01-01T00:01:00.000Z");
  // negative
  assert.equal(computeNextRun(baseSched({ intervalSec: -5 }), from), "2026-01-01T00:01:00.000Z");
  // non-finite
  assert.equal(computeNextRun(baseSched({ intervalSec: NaN }), from), "2026-01-01T00:01:00.000Z");
});

test("computeNextRun result is strictly after from", () => {
  const from = Date.now();
  const next = Date.parse(computeNextRun(baseSched({ intervalSec: 120 }), from));
  assert.ok(next > from, "next run is in the future");
});
