/**
 * src/server/__tests__/cors.test.ts — Real tests for CORS origin restriction.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  resolveAllowedOrigins,
  corsOriginFor,
  createCorsMiddleware,
} from "../cors.js";

test("resolveAllowedOrigins parses comma list", () => {
  assert.deepEqual(resolveAllowedOrigins("https://a.com, https://b.com ,"), [
    "https://a.com",
    "https://b.com",
  ]);
  assert.deepEqual(resolveAllowedOrigins(undefined), []);
});

test("corsOriginFor returns null when no origins configured", () => {
  assert.equal(corsOriginFor("https://evil.com", [], false), null);
});

test("corsOriginFor reflects exact allowed origin", () => {
  assert.equal(
    corsOriginFor("https://a.com", ["https://a.com", "https://b.com"], false),
    "https://a.com"
  );
});

test("corsOriginFor rejects disallowed origin", () => {
  assert.equal(
    corsOriginFor("https://evil.com", ["https://a.com"], false),
    null
  );
});

test("corsOriginFor honors explicit wildcard opt-in", () => {
  assert.equal(corsOriginFor("https://anything.com", ["*"], true), "*");
});

test("middleware emits allow-origin only for allowed origins; blocks others", async () => {
  const app = express();
  app.use(createCorsMiddleware({ allowedOrigins: "https://good.com" }));
  app.get("/api/x", (_req, res) => res.json({ ok: true }));

  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const good = await fetch(`${base}/api/x`, { headers: { origin: "https://good.com" } });
    assert.equal(good.headers.get("access-control-allow-origin"), "https://good.com");
    assert.equal(good.headers.get("vary"), "origin");

    const bad = await fetch(`${base}/api/x`, { headers: { origin: "https://bad.com" } });
    assert.equal(bad.headers.get("access-control-allow-origin"), null);
  } finally {
    srv.close();
  }
});

test("middleware answers OPTIONS pre-flight with 204", async () => {
  const app = express();
  app.use(createCorsMiddleware({ allowedOrigins: "https://good.com" }));
  app.options("/api/x", (_req, res) => res.json({})); // should be intercepted

  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}/api/x`, {
      method: "OPTIONS",
      headers: { origin: "https://good.com" },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-methods")?.includes("POST"), true);
  } finally {
    srv.close();
  }
});
