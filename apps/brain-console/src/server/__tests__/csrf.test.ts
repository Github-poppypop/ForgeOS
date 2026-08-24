/**
 * src/server/__tests__/csrf.test.ts — Real tests for CSRF double-submit
 * enforcement, including the live HTTP flow (mint token -> replay).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createCsrfMiddleware, generateCsrfToken, CSRF_COOKIE, CSRF_HEADER } from "../csrf.js";

function makeReq(over: Record<string, unknown> = {}) {
  return {
    method: "POST",
    url: "/api/ledger",
    originalUrl: "/api/ledger",
    headers: {} as Record<string, string>,
    ...over,
  } as any;
}

test("generateCsrfToken is unique and 32-byte base64url", () => {
  const a = generateCsrfToken();
  const b = generateCsrfToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
});

test("blocks POST without token", () => {
  const csrf = createCsrfMiddleware();
  let nexted = false;
  const res: any = {
    status() {
      return this;
    },
    json(payload: unknown) {
      this._json = payload;
      return this;
    },
  };
  csrf.middleware(makeReq(), res, () => {
    nexted = true;
  });
  assert.equal(nexted, false);
  assert.equal(res._json?.error, "csrf_token_invalid");
});

test("allows POST when header matches cookie", () => {
  const csrf = createCsrfMiddleware();
  const token = generateCsrfToken();
  let nexted = false;
  const res: any = { status() { return this; }, json() { return this; } };
  const req = makeReq({
    headers: { cookie: `${CSRF_COOKIE}=${token}`, [CSRF_HEADER]: token },
  });
  csrf.middleware(req, res, () => {
    nexted = true;
  });
  assert.equal(nexted, true);
});

test("rejects POST when header/cookie mismatch", () => {
  const csrf = createCsrfMiddleware();
  const res: any = { status() { return this; }, json(p: unknown) { this._j = p; return this; } };
  const req = makeReq({
    headers: { cookie: `${CSRF_COOKIE}=${generateCsrfToken()}`, [CSRF_HEADER]: generateCsrfToken() },
  });
  let nexted = false;
  csrf.middleware(req, res, () => { nexted = true; });
  assert.equal(nexted, false);
});

test("exempts GET and health path", () => {
  const csrf = createCsrfMiddleware();
  const res: any = { status() { return this; }, json() { return this; } };
  let nexted = false;
  csrf.middleware(makeReq({ method: "GET", url: "/api/health", originalUrl: "/api/health" }), res, () => { nexted = true; });
  assert.equal(nexted, true);
});

test("exempts requests carrying a bearer token", () => {
  const csrf = createCsrfMiddleware();
  const res: any = { status() { return this; }, json() { return this; } };
  let nexted = false;
  csrf.middleware(makeReq({ headers: { authorization: "Bearer xyz" } }), res, () => { nexted = true; });
  assert.equal(nexted, true);
});

test("live HTTP: token mint + protected POST enforced/allowed", async () => {
  const csrf = createCsrfMiddleware();
  const app = express();
  app.use(express.json());
  app.get("/api/csrf/token", (_req, res) => {
    const t = csrf.issueToken(res);
    res.json({ token: t });
  });
  app.use(csrf.middleware);
  let protectedRan = 0;
  app.post("/api/ledger", (_req, res) => {
    protectedRan += 1;
    res.json({ ok: true });
  });

  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    // 1) mint token
    const mintRes = await fetch(`${base}/api/csrf/token`);
    const setCookie = mintRes.headers.get("set-cookie") ?? "";
    const token = (await mintRes.json()).token as string;
    assert.ok(token, "token minted");

    // 2) POST without token -> 403
    const blocked = await fetch(`${base}/api/ledger`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(blocked.status, 403);

    // 3) POST with cookie + matching header -> 200
    const allowed = await fetch(`${base}/api/ledger`, {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: token, cookie: setCookie },
      body: "{}",
    });
    assert.equal(allowed.status, 200);
    assert.equal(protectedRan, 1);
  } finally {
    srv.close();
  }
});
