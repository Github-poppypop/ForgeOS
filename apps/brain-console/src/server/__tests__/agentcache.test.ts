/**
 * src/server/__tests__/agentcache.test.ts — Real tests for the in-memory agent
 * cache (feat-agentcache.ts): set/get/delete + 400 on empty key + meta
 * counters. Exercises the actual express routes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerAgentCache from "../features/feat-agentcache.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  registerAgentCache(app as unknown as import("express").Router);
  return app;
}

test("set requires a non-empty key (400)", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/agent-cache`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "", value: 1 }),
    });
    assert.equal(r.status, 400);
  } finally {
    srv.close();
  }
});

test("set then get returns the value; missing key is 404", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const set = await fetch(`http://127.0.0.1:${port}/api/agent-cache`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "greeting", value: "hello", ttlSec: 60 }),
    });
    assert.equal(set.status, 201);
    const sj = (await set.json()) as any;
    assert.equal(sj.key, "greeting");

    const get = await fetch(`http://127.0.0.1:${port}/api/agent-cache/greeting`);
    const gj = (await get.json()) as any;
    assert.equal(gj.ok, true);
    assert.equal(gj.value, "hello");

    const miss = await fetch(`http://127.0.0.1:${port}/api/agent-cache/nope`);
    assert.equal(miss.status, 404);
  } finally {
    srv.close();
  }
});

test("delete removes the key", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    await fetch(`http://127.0.0.1:${port}/api/agent-cache`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "temp", value: 1, ttlSec: 60 }),
    });
    const del = await fetch(`http://127.0.0.1:${port}/api/agent-cache/temp`, { method: "DELETE" });
    const dj = (await del.json()) as any;
    assert.equal(dj.ok, true);
    assert.equal(dj.deleted, true);

    const get = await fetch(`http://127.0.0.1:${port}/api/agent-cache/temp`);
    assert.equal(get.status, 404);
  } finally {
    srv.close();
  }
});

test("meta reports size and counters as numbers", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const meta = await fetch(`http://127.0.0.1:${port}/api/agent-cache/meta`);
    const mj = (await meta.json()) as any;
    assert.equal(typeof mj.size, "number");
    assert.equal(typeof mj.hits, "number");
    assert.equal(typeof mj.misses, "number");
    assert.equal(typeof mj.evictions, "number");
  } finally {
    srv.close();
  }
});
