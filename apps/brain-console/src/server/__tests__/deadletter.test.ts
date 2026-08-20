/**
 * src/server/__tests__/deadletter.test.ts — Real tests for the dead-letter
 * queue (feat-deadletter.ts): enqueue validation, list, retry, ack. Exercises
 * the actual express routes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerDeadLetter from "../features/feat-deadletter.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  registerDeadLetter(app as unknown as import("express").Router);
  return app;
}

test("enqueue requires id, task, and error (400 on missing)", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/agent/deadletter`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "", task: {}, error: "" }),
    });
    assert.equal(r.status, 400);
  } finally {
    srv.close();
  }
});

test("enqueue valid item, list it, retry, then ack", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const enq = await fetch(`http://127.0.0.1:${port}/api/agent/deadletter`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "dl-1", task: { x: 1 }, error: "boom" }),
    });
    assert.equal(enq.status, 201);
    const ej = (await enq.json()) as any;
    assert.equal(ej.item.status, "queued");

    const list = await fetch(`http://127.0.0.1:${port}/api/agent/deadletter`);
    const lj = (await list.json()) as any;
    assert.ok(lj.items.some((i: any) => i.id === "dl-1"));

    const retry = await fetch(`http://127.0.0.1:${port}/api/agent/deadletter/dl-1/retry`, { method: "POST" });
    const rj = (await retry.json()) as any;
    assert.equal(rj.item.status, "retrying");
    assert.equal(rj.item.attempts, 2);

    const ack = await fetch(`http://127.0.0.1:${port}/api/agent/deadletter/dl-1/ack`, { method: "POST" });
    const aj = (await ack.json()) as any;
    assert.equal(aj.removed, true);

    const list2 = await fetch(`http://127.0.0.1:${port}/api/agent/deadletter`);
    const lj2 = (await list2.json()) as any;
    assert.ok(!lj2.items.some((i: any) => i.id === "dl-1"));
  } finally {
    srv.close();
  }
});

test("retry/ack on unknown id returns 404", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    for (const path of ["/api/agent/deadletter/nope/retry", "/api/agent/deadletter/nope/ack"]) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST" });
      assert.equal(r.status, 404);
    }
  } finally {
    srv.close();
  }
});
