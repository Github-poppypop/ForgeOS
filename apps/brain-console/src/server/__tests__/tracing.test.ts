/**
 * src/server/__tests__/tracing.test.ts — Real tests for the tracing middleware.
 * Uses only Node built-ins (node:test + node:assert/strict) + express.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createTracingMiddleware, TRACE_HEADER, newTraceId } from "../tracing.js";

function makeRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    locals: {} as Record<string, unknown>,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = String(value);
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    once() {},
    on() {},
  };
  return { res, headers };
}

function makeReq(over: Record<string, unknown> = {}) {
  return {
    method: "GET",
    url: "/api/health",
    originalUrl: "/api/health",
    headers: {} as Record<string, string>,
    ...over,
  } as any;
}

test("assigns a fresh 32-hex trace id when none is inbound", () => {
  const { res, headers } = makeRes();
  const calls: Array<{ traceId: string; message: string }> = [];
  const mw = createTracingMiddleware({ logger: (e) => calls.push(e) });
  mw(makeReq(), res, () => {});

  const id = headers[TRACE_HEADER];
  assert.equal(typeof id, "string");
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].traceId, id);
  assert.equal(res.locals.traceId, id);
});

test("honors and continues an inbound trace id unchanged", () => {
  const { res, headers } = makeRes();
  const inbound = "abcdef0123456789abcdef0123456789";
  const mw = createTracingMiddleware();
  mw(makeReq({ headers: { [TRACE_HEADER]: inbound } }), res, () => {});

  assert.equal(headers[TRACE_HEADER], inbound);
});

test("calls next() exactly once", () => {
  const { res } = makeRes();
  let count = 0;
  const mw = createTracingMiddleware();
  mw(makeReq(), res, () => {
    count += 1;
  });
  assert.equal(count, 1);
});

test("newTraceId produces unique 32-hex ids", () => {
  const a = newTraceId();
  const b = newTraceId();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.match(b, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("wires into a real express app and echoes trace id on response", async () => {
  const app = express();
  app.use(createTracingMiddleware());
  app.get("/ping", (_req, res) => res.json({ ok: true }));
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const url = `http://127.0.0.1:${port}`;

  try {
    const inbound = "deadbeefdeadbeefdeadbeefdeadbeef";
    const res = await fetch(`${url}/ping`, {
      headers: { [TRACE_HEADER]: inbound },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get(TRACE_HEADER), inbound);
  } finally {
    srv.close();
  }
});
