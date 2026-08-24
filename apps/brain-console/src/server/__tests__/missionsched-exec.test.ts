/**
 * src/server/__tests__/missionsched-exec.test.ts — Real tests for the mission
 * scheduler executor status endpoint (feat-missionsched-exec.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerMissionExec from "../features/feat-missionsched-exec.js";

function makeApp() {
  const app = express();
  registerMissionExec(app as unknown as import("express").Router);
  return app;
}

test("GET /api/missions/schedule/executions returns an array + count", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/missions/schedule/executions`);
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.equal(j.ok, true);
    assert.ok(Array.isArray(j.executions), "executions is an array");
    assert.equal(typeof j.count, "number");
    assert.equal(j.count, j.executions.length);
  } finally {
    srv.close();
  }
});
