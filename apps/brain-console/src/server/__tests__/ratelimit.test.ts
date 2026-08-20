/**
 * src/server/__tests__/ratelimit.test.ts — Real tests for the in-memory rate
 * limiter (ratelimit.ts): passes within the limit, 429 + Retry-After when
 * exceeded, the NODE_ENV=test disable path, and snapshot accounting.
 *
 * The module reads NODE_ENV/RATE_LIMIT_DISABLED at import time, so each test
 * dynamically imports after setting the env, with a cache-busting query to get
 * a fresh module instance per scenario.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction } from "express";

let seq = 0;
async function loadRateLimit() {
  seq += 1;
  return (await import(`../ratelimit.js?v=${seq}`)) as typeof import("../ratelimit.js");
}

function appWith(mw: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.use((req, res, next) => mw(req, res, next));
  app.get("/ping", (_req, res) => res.json({ ok: true }));
  return app;
}

test("allows requests under the limit", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.RATE_LIMIT_DISABLED;
  const rl = await loadRateLimit();
  const app = appWith(rl.rateLimit({ max: 3, windowMs: 60_000 }));
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-forwarded-for": "10.0.0.1" } });
      assert.equal(r.status, 200, `hit ${i} should pass`);
    }
  } finally {
    srv.close();
  }
});

test("blocks with 429 + Retry-After once the limit is exceeded", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.RATE_LIMIT_DISABLED;
  const rl = await loadRateLimit();
  const app = appWith(rl.rateLimit({ max: 2, windowMs: 60_000 }));
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const ip = "10.0.0.2";
    for (let i = 0; i < 2; i++) {
      const ok = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-forwarded-for": ip } });
      assert.equal(ok.status, 200);
    }
    const blocked = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-forwarded-for": ip } });
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get("retry-after"), "Retry-After header set");
    const body = (await blocked.json()) as any;
    assert.equal(body.ok, false);
    assert.equal(body.error, "rate_limited");
    assert.equal(typeof body.retryAfter, "number");
  } finally {
    srv.close();
  }
});

test("NODE_ENV=test disables the limiter (always passes)", async () => {
  process.env.NODE_ENV = "test";
  delete process.env.RATE_LIMIT_DISABLED;
  const rl = await loadRateLimit();
  const app = appWith(rl.rateLimit({ max: 1, windowMs: 60_000 }));
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const ip = "10.0.0.3";
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-forwarded-for": ip } });
      assert.equal(r.status, 200, `disabled: hit ${i} should pass`);
    }
  } finally {
    srv.close();
    process.env.NODE_ENV = "production";
  }
});

test("snapshot reports hits and blocked counts", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.RATE_LIMIT_DISABLED;
  const rl = await loadRateLimit();
  const app = appWith(rl.rateLimit({ max: 1, windowMs: 60_000 }));
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const ip = "10.0.0.4";
    await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-forwarded-for": ip } }); // pass
    await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-forwarded-for": ip } }); // 429
    const snap = rl.getRateLimitSnapshot();
    assert.equal(typeof snap.totalHits, "number");
    assert.equal(typeof snap.totalBlocked, "number");
    assert.ok(snap.totalHits >= 2, "at least the 2 hits recorded");
    assert.ok(snap.totalBlocked >= 1, "the blocked hit is counted");
  } finally {
    srv.close();
  }
});
