/**
 * src/server/__tests__/webhooks.test.ts — Real tests for the webhook delivery
 * engine (feat-webhooks.ts): create validation, list, publish fan-out count,
 * echo sink, and delete (including unknown-id 404). The real external /test
 * fetch path is intentionally not exercised (no outbound network in tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerWebhooks from "../features/feat-webhooks.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  registerWebhooks(app as unknown as import("express").Router);
  return app;
}

test("create requires a valid http(s) url (400 on bad url)", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/webhooks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "not-a-url", event: "mission.created" }),
    });
    assert.equal(r.status, 400);
  } finally {
    srv.close();
  }
});

test("create valid webhook, list it, publish, then delete", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const created = await fetch(`http://127.0.0.1:${port}/api/webhooks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/hook", event: "*" }),
    });
    assert.equal(created.status, 201);
    const cj = (await created.json()) as any;
    assert.equal(cj.ok, true);
    const id = cj.webhook.id;
    assert.ok(id, "returns a generated id");

    const list = await fetch(`http://127.0.0.1:${port}/api/webhooks`);
    const lj = (await list.json()) as any;
    assert.ok(lj.webhooks.some((w: any) => w.id === id), "listed");
    assert.ok(Array.isArray(lj.events), "events enumerated");

    const pub = await fetch(`http://127.0.0.1:${port}/api/webhooks/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "mission.created", payload: { id: 1 } }),
    });
    const pj = (await pub.json()) as any;
    assert.equal(pub.status, 202);
    assert.equal(typeof pj.delivered, "number");

    const del = await fetch(`http://127.0.0.1:${port}/api/webhooks/${id}`, { method: "DELETE" });
    assert.equal(del.status, 200);
  } finally {
    srv.close();
  }
});

test("echo sink returns the received body", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/webhooks/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    const j = (await r.json()) as any;
    assert.equal(j.ok, true);
    assert.equal(j.received, true);
    assert.equal(j.body.hello, "world");
  } finally {
    srv.close();
  }
});

test("delete unknown webhook id returns 404", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/webhooks/does-not-exist`, { method: "DELETE" });
    assert.equal(r.status, 404);
  } finally {
    srv.close();
  }
});
