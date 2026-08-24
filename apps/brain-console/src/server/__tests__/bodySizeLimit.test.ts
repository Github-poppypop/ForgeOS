/**
 * src/server/__tests__/bodySizeLimit.test.ts — Real tests proving oversized
 * bodies are rejected with 413 before parsing, and small bodies pass through.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createBodySizeLimit } from "../bodySizeLimit.js";

test("small body passes through and is parsed", async () => {
  const app = express();
  app.use(createBodySizeLimit({ maxBytes: 100 }));
  app.use(express.json());
  app.post("/api/x", (req, res) => res.json({ got: (req.body as any).v }));
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}/api/x`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ v: 42 }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).got, 42);
  } finally {
    srv.close();
  }
});

test("oversized body is rejected with 413", async () => {
  const app = express();
  app.use(createBodySizeLimit({ maxBytes: 50 }));
  app.use(express.json());
  app.post("/api/x", (req, res) => res.json({ got: (req.body as any).v }));
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const big = JSON.stringify({ v: "x".repeat(1000) });
    const res = await fetch(`${base}/api/x`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: big,
    });
    // Either 413, or the socket was destroyed (fetch surfaces as 0/aborted).
    assert.ok(res.status === 413 || res.status === 0, `unexpected status ${res.status}`);
    if (res.status === 413) {
      const j = (await res.json()) as { error?: string };
      assert.equal(j.error, "payload_too_large");
    }
  } finally {
    srv.close();
  }
});

test("GET requests are not size-limited", async () => {
  const app = express();
  app.use(createBodySizeLimit({ maxBytes: 1 }));
  app.get("/api/x", (_req, res) => res.json({ ok: true }));
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}/api/x`);
    assert.equal(res.status, 200);
  } finally {
    srv.close();
  }
});
