/**
 * src/server/__tests__/auditstore.test.ts — Real tests for the durable audit
 * store (feat-auditstore.ts): append validation, persistence to the ring
 * buffer, and meta reporting. Exercises the actual express routes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerAuditStore from "../features/feat-auditstore.js";

function makeApp() {
  const app = express();
  registerAuditStore(app as unknown as import("express").Router);
  return app;
}

test("rejects a non-object audit body with 400", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/audit/append`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([1, 2, 3]),
    });
    assert.equal(r.status, 400);
  } finally {
    srv.close();
  }
});

test("appends a valid audit entry and it appears in the store", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const entry = { ts: new Date().toISOString(), action: "login", actor: "agent-7" };
    const post = await fetch(`http://127.0.0.1:${port}/api/audit/append`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
    assert.equal(post.status, 201);
    const pj = (await post.json()) as any;
    assert.equal(pj.ok, true);

    const store = await fetch(`http://127.0.0.1:${port}/api/audit/store`);
    const sj = (await store.json()) as any[];
    assert.ok(Array.isArray(sj));
    assert.ok(sj.some((e) => (e as any).actor === "agent-7" && (e as any).action === "login"));
  } finally {
    srv.close();
  }
});

test("meta reports byte/line counts as numbers", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const meta = await fetch(`http://127.0.0.1:${port}/api/audit/store/meta`);
    const mj = (await meta.json()) as any;
    assert.equal(typeof mj.bytes, "number");
    assert.equal(typeof mj.lines, "number");
    assert.equal(typeof mj.generations, "number");
  } finally {
    srv.close();
  }
});
