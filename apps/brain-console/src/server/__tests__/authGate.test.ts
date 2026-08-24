/**
 * src/server/__tests__/authGate.test.ts — Real tests for the token-auth gate,
 * including env-gated enable/disable and login-issued token verification.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createAuthGate } from "../authGate.js";

test("gate is disabled when no secrets configured (open by default)", () => {
  const g = createAuthGate({ consoleToken: undefined, jwtSecret: undefined });
  assert.equal(g.isEnabled(), false);
  let nexted = false;
  const res: any = { status() { return this; }, json() { return this; } };
  g.middleware({ method: "POST", url: "/api/ledger", headers: {} }, res, () => { nexted = true; });
  assert.equal(nexted, true);
});

test("blocks protected route without token when enabled", () => {
  const g = createAuthGate({ consoleToken: "secret-123" });
  let nexted = false;
  const res: any = { status() { return this; }, json(p: unknown) { this._j = p; return this; } };
  g.middleware({ method: "POST", url: "/api/ledger", headers: {} }, res, () => { nexted = true; });
  assert.equal(nexted, false);
  assert.equal(res._j?.error, "unauthorized");
});

test("accepts the configured CONSOLE_TOKEN", () => {
  const g = createAuthGate({ consoleToken: "secret-123" });
  let nexted = false;
  const res: any = { status() { return this; }, json() { return this; } };
  g.middleware({ method: "POST", url: "/api/ledger", headers: { authorization: "Bearer secret-123" } }, res, () => { nexted = true; });
  assert.equal(nexted, true);
});

test("rejects a wrong token", () => {
  const g = createAuthGate({ consoleToken: "secret-123" });
  let nexted = false;
  const res: any = { status() { return this; }, json() { return this; } };
  g.middleware({ method: "POST", url: "/api/ledger", headers: { authorization: "Bearer nope" } }, res, () => { nexted = true; });
  assert.equal(nexted, false);
});

test("public paths are always open even when enabled", () => {
  const g = createAuthGate({ consoleToken: "secret-123" });
  let nexted = false;
  const res: any = { status() { return this; }, json() { return this; } };
  g.middleware({ method: "GET", url: "/api/health", headers: {} }, res, () => { nexted = true; });
  assert.equal(nexted, true);
  nexted = false;
  g.middleware({ method: "POST", url: "/api/auth/login", headers: {} }, res, () => { nexted = true; });
  assert.equal(nexted, true);
});

test("login-issued signed token is accepted and expires", () => {
  const g = createAuthGate({ jwtSecret: "my-secret" });
  const token = g.issueToken("user");
  let nexted = false;
  const res: any = { status() { return this; }, json() { return this; } };
  g.middleware({ method: "POST", url: "/api/ledger", headers: { authorization: `Bearer ${token}` } }, res, () => { nexted = true; });
  assert.equal(nexted, true);

  // Tampered signature must be rejected.
  let nexted2 = false;
  const res2: any = { status() { return this; }, json() { return this; } };
  g.middleware({ method: "POST", url: "/api/ledger", headers: { authorization: `Bearer ${token.slice(0, -2)}xx` } }, res2, () => { nexted2 = true; });
  assert.equal(nexted2, false);
});

test("live HTTP: 401 without token, 200 with token", async () => {
  const g = createAuthGate({ consoleToken: "abc" });
  const app = express();
  app.use(g.middleware);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/secret", (_req, res) => res.json({ ok: true }));

  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const publicRes = await fetch(`${base}/api/health`);
    assert.equal(publicRes.status, 200);

    const blocked = await fetch(`${base}/api/secret`);
    assert.equal(blocked.status, 401);

    const allowed = await fetch(`${base}/api/secret`, { headers: { authorization: "Bearer abc" } });
    assert.equal(allowed.status, 200);
  } finally {
    srv.close();
  }
});
