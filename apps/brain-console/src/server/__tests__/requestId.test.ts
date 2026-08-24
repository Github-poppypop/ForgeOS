/**
 * src/server/__tests__/requestId.test.ts — Real tests for request-id
 * correlation: inbound id is echoed, missing id is generated, and the
 * structured log line carries the id.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createRequestId } from "../requestId.js";

function buildApp(opts?: Parameters<typeof createRequestId>[0]) {
  const lines: Record<string, unknown>[] = [];
  const app = express();
  app.use(createRequestId({ log: (l) => lines.push(l), ...opts }));
  app.get("/ping", (_req, res) => res.json({ ok: true }));
  return { app, lines };
}

test("inbound x-trace-id is echoed as x-request-id and logged", async () => {
  const { app, lines } = buildApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-trace-id": "abc-123" } });
    assert.equal(r.headers.get("x-request-id"), "abc-123");
    assert.equal(r.status, 200);
    await new Promise((res) => setTimeout(res, 10));
    assert.equal(lines.length, 1);
    assert.equal((lines[0] as any).requestId, "abc-123");
    assert.equal((lines[0] as any).path, "/ping");
  } finally {
    srv.close();
  }
});

test("missing id is generated (uuid) and echoed", async () => {
  const { app, lines } = buildApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/ping`);
    const echoed = r.headers.get("x-request-id");
    assert.ok(echoed && echoed.length > 0, "should generate an id");
    await new Promise((res) => setTimeout(res, 10));
    assert.equal((lines[0] as any).requestId, echoed);
  } finally {
    srv.close();
  }
});

test("custom inbound header is honored", async () => {
  const { app, lines } = buildApp({ inboundHeader: "x-trace-id" });
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-trace-id": "trace-xyz" } });
    assert.equal(r.headers.get("x-request-id"), "trace-xyz");
    await new Promise((res) => setTimeout(res, 10));
    assert.equal((lines[0] as any).requestId, "trace-xyz");
  } finally {
    srv.close();
  }
});
