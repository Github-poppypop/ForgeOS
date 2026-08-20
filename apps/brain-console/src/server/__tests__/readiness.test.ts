/**
 * src/server/__tests__/readiness.test.ts — Pure-logic tests for the readiness
 * report (no network). The live HTTP probe lives in feat-readiness.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createReadiness } from "../readiness.js";

test("readiness ready when not shutting down and data dir writable", () => {
  const r = createReadiness({ isShuttingDown: () => false });
  const report = r.report();
  assert.equal(report.ready, true);
  assert.equal(report.shuttingDown, false);
  assert.equal(report.dataDirWritable, true);
  assert.equal(report.checks.notShuttingDown, true);
});

test("readiness not-ready while shutting down", () => {
  const r = createReadiness({ isShuttingDown: () => true });
  const report = r.report();
  assert.equal(report.ready, false);
  assert.equal(report.shuttingDown, true);
  assert.equal(report.checks.notShuttingDown, false);
});

test("readiness not-ready when data dir is unwritable", () => {
  const r = createReadiness({
    isShuttingDown: () => false,
    writableCheck: () => false,
  });
  const report = r.report();
  assert.equal(report.dataDirWritable, false);
  assert.equal(report.ready, false);
});
