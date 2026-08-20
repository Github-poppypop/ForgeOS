/**
 * src/server/__tests__/apidocs.test.ts — Real tests for the API docs feature
 * (feat-apidocs.ts): /api/openapi.json returns the valid spec, /api/docs returns HTML.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerApiDocs from "../features/feat-apidocs.js";

function makeApp() {
  const app = express();
  registerApiDocs(app as unknown as import("express").Router);
  return app;
}

test("GET /api/openapi.json returns 200 with parseable JSON spec", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/openapi.json`);
    assert.equal(r.status, 200);
    const ct = r.headers.get("content-type") ?? "";
    assert.ok(ct.includes("application/json"), "served as JSON");
    const spec = (await r.json()) as any;
    assert.ok(typeof spec === "object" && spec !== null, "valid JSON object");
    // A real OpenAPI doc should declare at least an openapi/paths/swagger key.
    assert.ok(spec.openapi || spec.swagger || spec.paths, "looks like an API spec");
  } finally {
    srv.close();
  }
});

test("GET /api/docs returns HTML", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/docs`);
    assert.equal(r.status, 200);
    const ct = r.headers.get("content-type") ?? "";
    assert.ok(ct.includes("text/html"), "served as HTML");
    const html = await r.text();
    assert.ok(html.includes("<"), "contains HTML markup");
  } finally {
    srv.close();
  }
});
