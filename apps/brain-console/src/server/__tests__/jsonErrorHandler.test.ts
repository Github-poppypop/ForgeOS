/**
 * src/server/__tests__/jsonErrorHandler.test.ts — Real tests proving malformed
 * JSON yields a clean 400 JSON response (no stack disclosure) and other thrown
 * errors still 500.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createJsonErrorHandler } from "../jsonErrorHandler.js";

function buildApp(withHandler: boolean) {
  const app = express();
  app.use(express.json());
  if (withHandler) {
    const h = createJsonErrorHandler();
    app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) =>
      (h as (e: unknown, r: express.Request, rs: express.Response, n: express.NextFunction) => void)(err, req, res, next),
    );
  }
  app.post("/echo", (req, res) => res.json({ got: req.body }));
  app.get("/boom", () => {
    throw new Error("kaboom");
  });
  return app;
}

test("malformed JSON returns clean 400 JSON with handler installed", async () => {
  const app = buildApp(true);
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ this is not json ",
    });
    assert.equal(r.status, 400);
    assert.equal(r.headers.get("content-type"), "application/json; charset=utf-8");
    const j = (await r.json()) as any;
    assert.equal(j.code, "BAD_REQUEST_BODY");
    assert.equal(j.ok, false);
    assert.ok(!JSON.stringify(j).includes("at JSON.parse"));
  } finally {
    srv.close();
  }
});

test("valid JSON still works", async () => {
  const app = buildApp(true);
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.equal(j.got.hello, "world");
  } finally {
    srv.close();
  }
});

test("route that throws is handled as 500, not a crash", async () => {
  const app = buildApp(true);
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/boom`);
    assert.equal(r.status, 500);
  } finally {
    srv.close();
  }
});

test("without handler, malformed JSON leaks an HTML stack trace (the gap)", async () => {
  const app = buildApp(false);
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ bad ",
    });
    // Express 5 returns 400 but with text/html + raw stack — not a clean API error.
    assert.equal(r.status, 400);
    assert.ok((r.headers.get("content-type") || "").includes("text/html"));
    const body = await r.text();
    assert.ok(body.includes("SyntaxError") || body.includes("at JSON.parse"));
  } finally {
    srv.close();
  }
});
