import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import { createRuntime, stopAllSchedules } from "../src/server/runtime.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schedulesFile = path.resolve(here, "..", "src", "server", "..", "..", "data", "schedules.json");

let server: Server;
let base = "";

async function request(method: string, p: string, body?: unknown) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

before(async () => {
  try {
    fs.rmSync(schedulesFile, { force: true });
  } catch {
    /* ignore */
  }
  const app = express();
  app.use(express.json());
  app.use(await createRuntime());
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  stopAllSchedules();
  try {
    (server as any).closeAllConnections?.();
  } catch {
    /* ignore */
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("mission scheduling", () => {
  it("creates, lists, runs, and deletes a persisted schedule", async () => {
    const slug = `schedtest-${Date.now()}`;
    const create = await request("POST", "/api/schedules", {
      slug,
      type: "note",
      intervalMs: 3600000,
      title: "Test mission",
      body: "auto captured",
    });
    assert.equal(create.status, 201);
    assert.ok(create.json.schedule && typeof create.json.schedule.id === "string");
    const id = create.json.schedule.id as string;

    const list = await request("GET", "/api/schedules");
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.json.schedules));
    assert.ok(list.json.schedules.some((s: any) => s.id === id));

    // Persisted to disk at data/schedules.json
    assert.ok(fs.existsSync(schedulesFile), "schedules.json should be written");
    const onDisk = JSON.parse(fs.readFileSync(schedulesFile, "utf8")) as any[];
    assert.ok(onDisk.some((s) => s.id === id));

    // Manual run triggers a capture (page is created)
    const run = await request("POST", `/api/schedules/${id}/run`);
    assert.equal(run.status, 200);
    assert.equal(run.json.ok, true);

    const page = await request("GET", `/api/page/${encodeURIComponent(slug)}`);
    assert.equal(page.status, 200);
    assert.equal(page.json.page.slug, slug);

    // Delete removes it and persists
    const del = await request("DELETE", `/api/schedules/${id}`);
    assert.equal(del.status, 200);
    assert.equal(del.json.ok, true);

    const list2 = await request("GET", "/api/schedules");
    assert.ok(!list2.json.schedules.some((s: any) => s.id === id));
    const onDisk2 = JSON.parse(fs.readFileSync(schedulesFile, "utf8")) as any[];
    assert.ok(!onDisk2.some((s) => s.id === id));
  });

  it("rejects a schedule missing required fields", async () => {
    const res = await request("POST", "/api/schedules", { slug: "only-slug" });
    assert.equal(res.status, 400);
  });

  it("returns 404 for unknown schedule delete/run", async () => {
    const del = await request("DELETE", "/api/schedules/does-not-exist");
    assert.equal(del.status, 404);
    const run = await request("POST", "/api/schedules/does-not-exist/run");
    assert.equal(run.status, 404);
  });
});
