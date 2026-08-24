/**
 * src/server/__tests__/workspaces.test.ts — Real tests for the multi-agent
 * workspaces feature (CRUD + members + append-only activity feed). Exercises
 * the actual express routes registered by feat-workspaces via an in-process
 * server, asserting end-to-end behaviour.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerWorkspaces from "../features/feat-workspaces.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  registerWorkspaces(app as unknown as import("express").Router);
  return app;
}

test("create workspace then list it", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const created = await fetch(`${base}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mission Alpha" }),
    });
    assert.equal(created.status, 201);
    const cj = (await created.json()) as any;
    assert.equal(cj.ok, true);
    assert.ok(cj.workspace?.id, "returns an id");
    const id = cj.workspace.id;

    const list = await fetch(`${base}/api/workspaces`);
    const lj = (await list.json()) as any;
    assert.equal(lj.ok, true);
    assert.ok(lj.workspaces.some((w: any) => w.id === id && w.name === "Mission Alpha"));
  } finally {
    srv.close();
  }
});

test("rejects workspace creation without a name", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    srv.close();
  }
});

test("join member and append feed, then read them back", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const c = await fetch(`${base}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "W" }),
    });
    const id = ((await c.json()) as any).workspace.id;

    const join = await fetch(`${base}/api/workspaces/${id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "agent-7" }),
    });
    assert.equal(join.status, 200);

    const members = await fetch(`${base}/api/workspaces/${id}/members`);
    const mj = (await members.json()) as any;
    assert.ok(mj.members.some((m: any) => m.name === "agent-7"));

    const feed = await fetch(`${base}/api/workspaces/${id}/feed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent: "agent-7", text: "started task" }),
    });
    assert.equal(feed.status, 201);

    const feedGet = await fetch(`${base}/api/workspaces/${id}/feed`);
    const fj = (await feedGet.json()) as any;
    assert.ok(fj.feed.some((e: any) => e.agent === "agent-7" && e.text === "started task"));
  } finally {
    srv.close();
  }
});

test("unknown workspace returns 404", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}/api/workspaces/nope/members`);
    assert.equal(res.status, 404);
  } finally {
    srv.close();
  }
});
