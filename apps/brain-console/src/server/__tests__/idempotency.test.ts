/**
 * src/server/__tests__/idempotency.test.ts — Real tests proving request
 * de-duplication actually prevents a handler from re-executing on replay.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createIdempotencyMiddleware, createIdempotencyStore, IDEMPOTENCY_HEADER } from "../idempotency.js";

test("store caches and replays on get", () => {
  const store = createIdempotencyStore({ ttlMs: 1000 });
  store.set("k1", { status: 201, body: "{\"ok\":true}", contentType: "application/json", createdAt: Date.now(), method: "POST" });
  const rec = store.get("k1");
  assert.equal(rec?.status, 201);
  assert.equal(rec?.body, "{\"ok\":true}");
});

test("store drops expired entries", () => {
  const store = createIdempotencyStore({ ttlMs: 10 });
  store.set("k", { status: 200, body: "x", contentType: "text/plain", createdAt: Date.now() - 100, method: "POST" });
  assert.equal(store.get("k"), undefined);
});

test("first request runs handler; replay returns cached response without re-running", async () => {
  let executions = 0;
  const app = express();
  app.use(express.json());
  app.use(createIdempotencyMiddleware());
  app.post("/api/ledger", (_req, res) => {
    executions += 1;
    res.status(201).json({ created: executions });
  });

  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const key = "ledger-abc-123";
  try {
    const r1 = await fetch(`${base}/api/ledger`, {
      method: "POST",
      headers: { "content-type": "application/json", [IDEMPOTENCY_HEADER]: key },
      body: JSON.stringify({ title: "x" }),
    });
    const b1 = await r1.json();
    assert.equal(r1.status, 201);
    assert.equal(executions, 1);

    // Replay with the SAME key + SAME body.
    const r2 = await fetch(`${base}/api/ledger`, {
      method: "POST",
      headers: { "content-type": "application/json", [IDEMPOTENCY_HEADER]: key },
      body: JSON.stringify({ title: "x" }),
    });
    const b2 = await r2.json();
    assert.equal(r2.status, 201);
    assert.equal(b2.created, 1, "replay must return the cached first result");
    assert.equal(executions, 1, "handler must NOT re-execute on replay");
    assert.equal(r2.headers.get("idempotency-replayed"), "true");
  } finally {
    srv.close();
  }
});

test("different idempotency keys are treated as distinct requests", async () => {
  let executions = 0;
  const app = express();
  app.use(express.json());
  app.use(createIdempotencyMiddleware());
  app.post("/api/things", (_req, res) => {
    executions += 1;
    res.status(201).json({ n: executions });
  });
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fetch(`${base}/api/things`, { method: "POST", headers: { [IDEMPOTENCY_HEADER]: "a" }, body: "{}" });
    await fetch(`${base}/api/things`, { method: "POST", headers: { [IDEMPOTENCY_HEADER]: "b" }, body: "{}" });
    assert.equal(executions, 2);
  } finally {
    srv.close();
  }
});

test("GET requests are not idempotency-scoped", async () => {
  let executions = 0;
  const app = express();
  app.use(createIdempotencyMiddleware());
  app.get("/api/search", (_req, res) => {
    executions += 1;
    res.json({ n: executions });
  });
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fetch(`${base}/api/search`, { headers: { [IDEMPOTENCY_HEADER]: "same" } });
    await fetch(`${base}/api/search`, { headers: { [IDEMPOTENCY_HEADER]: "same" } });
    assert.equal(executions, 2);
  } finally {
    srv.close();
  }
});
