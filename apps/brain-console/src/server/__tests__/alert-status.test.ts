/**
 * src/server/__tests__/alert-status.test.ts — Real tests for the alerting
 * status feature (feat-alert-status.ts): status payload shape and the test
 * dispatch endpoint.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerAlertStatus from "../features/feat-alert-status.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  registerAlertStatus(app as unknown as import("express").Router);
  return app;
}

test("GET /api/alerting/status reports a mode", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/alerting/status`);
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.ok(typeof j.mode === "string", "mode is reported");
  } finally {
    srv.close();
  }
});

test("POST /api/alerting/test returns a dispatched boolean", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/alerting/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.equal(j.ok, true);
    assert.equal(typeof j.dispatched, "boolean");
  } finally {
    srv.close();
  }
});
