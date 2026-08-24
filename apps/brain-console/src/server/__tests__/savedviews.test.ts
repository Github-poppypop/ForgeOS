/**
 * src/server/__tests__/savedviews.test.ts — Real tests for the saved-views
 * feature (CRUD + panel validation + id lookup). Exercises the actual express
 * routes registered by feat-savedviews via an in-process server.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerSavedViews from "../features/feat-savedviews.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  registerSavedViews(app as unknown as import("express").Router);
  return app;
}

test("rejects a saved view with an invalid panel", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/saved-views`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panel: "bogus", name: "x", filters: {} }),
    });
    assert.equal(r.status, 400);
  } finally {
    srv.close();
  }
});

test("rejects a saved view with no name", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/saved-views`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panel: "vault", name: "", filters: {} }),
    });
    assert.equal(r.status, 400);
  } finally {
    srv.close();
  }
});

test("creates a saved view, lists it, and fetches by id", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const created = await fetch(`http://127.0.0.1:${port}/api/saved-views`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panel: "missions", name: "Open only", filters: { status: "open" } }),
    });
    assert.equal(created.status, 201);
    const cj = (await created.json()) as any;
    assert.equal(cj.ok, true);
    assert.ok(cj.view?.id, "returns an id");
    const id = cj.view.id;

    const byId = await fetch(`http://127.0.0.1:${port}/api/saved-views/${id}`);
    const bj = (await byId.json()) as any;
    assert.equal(bj.ok, true);
    assert.equal(bj.view.name, "Open only");

    const list = await fetch(`http://127.0.0.1:${port}/api/saved-views?panel=missions`);
    const lj = (await list.json()) as any;
    assert.ok(lj.views.some((v: any) => v.id === id));
  } finally {
    srv.close();
  }
});

test("unknown saved-view id returns 404", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/saved-views/nope`);
    assert.equal(r.status, 404);
  } finally {
    srv.close();
  }
});
