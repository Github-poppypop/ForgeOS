/**
 * src/server/__tests__/changelog.test.ts — Real tests for the changelog API
 * (feat-changelog.ts): parses CHANGELOG.md into releases.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerChangelog from "../features/feat-changelog.js";

function makeApp() {
  const app = express();
  registerChangelog(app as unknown as import("express").Router);
  return app;
}

test("GET /api/changelog returns parsed releases + markdown", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/changelog`);
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.ok(Array.isArray(j.releases), "releases is an array");
    assert.ok(j.releases.length >= 1, "at least one release parsed");
    assert.ok(typeof j.markdown === "string" && j.markdown.length > 0, "markdown returned");
    // Each release should have a version-ish title.
    assert.ok("version" in j.releases[0] || "title" in j.releases[0]);
  } finally {
    srv.close();
  }
});
