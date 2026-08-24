/**
 * src/server/__tests__/feat-readiness.test.ts — Live HTTP test for the
 * /api/ready readiness endpoint exposed by feat-readiness. Split out from the
 * pure-logic readiness.test.ts because this file opens a listening server.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerReadiness, { shutdownState } from "../features/feat-readiness.js";

test("HTTP /api/ready returns 200 when ready, 503 when not", async () => {
  shutdownState.shuttingDown = false;
  const router = express.Router();
  registerReadiness(router);
  const app = express();
  app.use(router);
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const ok = await fetch(`${base}/api/ready`);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).ready, true);

    shutdownState.shuttingDown = true;
    const bad = await fetch(`${base}/api/ready`);
    assert.equal(bad.status, 503);
    assert.equal((await bad.json()).ready, false);
  } finally {
    srv.close();
  }
});
