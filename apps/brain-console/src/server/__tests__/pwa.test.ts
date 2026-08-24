/**
 * src/server/__tests__/pwa.test.ts — Real tests for the PWA manifest bridge
 * (feat-pwa.ts): /manifest.webmanifest serves the public manifest as
 * application/manifest+json.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerPwa from "../features/feat-pwa.js";

function makeApp() {
  const app = express();
  registerPwa(app as unknown as import("express").Router);
  return app;
}

test("GET /manifest.webmanifest returns the manifest as application/manifest+json", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
    assert.equal(r.status, 200);
    const ct = r.headers.get("content-type") ?? "";
    assert.ok(ct.includes("application/manifest+json"), "served as manifest+json");
    const m = (await r.json()) as any;
    assert.ok(typeof m.name === "string" && m.name.length > 0, "manifest has a name");
  } finally {
    srv.close();
  }
});
