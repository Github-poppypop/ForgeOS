/**
 * src/server/__tests__/gracefulShutdown.test.ts — Real tests for graceful
 * shutdown plan + handler behaviour (deterministic, no real signals).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShutdownPlan, installGracefulShutdown } from "../gracefulShutdown.js";

test("buildShutdownPlan records signal, grace, and server presence", () => {
  const fakeServer: any = { close: (cb: any) => cb?.() };
  const plan = buildShutdownPlan("SIGTERM", { server: fakeServer, graceMs: 5000 });
  assert.equal(plan.reason, "SIGTERM");
  assert.equal(plan.graceMs, 5000);
  assert.equal(plan.hasServer, true);
});

test("shutdown closes the server and exits 0", () => {
  let closed = false;
  const fakeServer: any = { close: (cb: any) => { closed = true; cb?.(); } };
  let exitCode: number | null = null;
  const fn = installGracefulShutdown({
    server: fakeServer,
    graceMs: 50,
    exit: (c) => { exitCode = c; },
    log: () => {},
  });
  fn("SIGTERM");
  assert.equal(closed, true);
  assert.equal(exitCode, 0);
});

test("shutdown notifies clients via onShutdown", () => {
  let notified: string | null = null;
  const fakeServer: any = { close: (cb: any) => cb?.() };
  const fn = installGracefulShutdown({
    server: fakeServer,
    graceMs: 50,
    onShutdown: (r) => { notified = r; },
    exit: () => {},
    log: () => {},
  });
  fn("SIGINT");
  assert.equal(notified, "SIGINT");
});

test("calling shutdown twice only triggers once", () => {
  let closed = 0;
  const fakeServer: any = { close: (cb: any) => { closed += 1; cb?.(); } };
  const fn = installGracefulShutdown({
    server: fakeServer,
    graceMs: 50,
    exit: () => {},
    log: () => {},
  });
  fn("SIGTERM");
  fn("SIGTERM");
  assert.equal(closed, 1);
});
