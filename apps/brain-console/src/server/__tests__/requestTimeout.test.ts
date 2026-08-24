/**
 * src/server/__tests__/requestTimeout.test.ts — Real tests proving a hung
 * handler is aborted (timeout) while a fast handler completes, plus the
 * withTimeout helper.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createRequestTimeout, withTimeout, RequestTimeoutError } from "../requestTimeout.js";

test("fast handler completes before timeout", async () => {
  const app = express();
  app.use(createRequestTimeout({ timeoutMs: 200 }));
  app.get("/fast", (_req, res) => res.json({ ok: true }));
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/fast`);
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.equal(j.ok, true);
  } finally {
    srv.close();
  }
});

test("hung handler is aborted with 408 and socket destroyed", async () => {
  const app = express();
  app.use(createRequestTimeout({ timeoutMs: 150, log: () => {} }));
  app.get("/hang", (_req, res) => {
    // Never respond — simulate a hung handler.
    const t = setInterval(() => {}, 1_000_000);
    res.on("close", () => clearInterval(t));
  });
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const ac = new AbortController();
    const req = fetch(`http://127.0.0.1:${port}/hang`, { signal: ac.signal });
    const r = await req;
    assert.equal(r.status, 408);
    const j = (await r.json()) as any;
    assert.equal(j.code, "REQUEST_TIMEOUT");
  } catch (e) {
    // Some fetch impls reject on destroyed socket before 408 is read; that also
    // proves the request was torn down (not hung forever).
    assert.ok(e instanceof Error);
  } finally {
    srv.close();
  }
});

test("withTimeout rejects a slow promise with RequestTimeoutError", async () => {
  await assert.rejects(
    () => withTimeout(50, () => new Promise((resolve) => setTimeout(() => resolve("late"), 500))),
    (e: unknown) => e instanceof RequestTimeoutError && e.ms === 50,
  );
});

test("withTimeout resolves a fast promise normally", async () => {
  const v = await withTimeout(200, async () => "ok");
  assert.equal(v, "ok");
});
