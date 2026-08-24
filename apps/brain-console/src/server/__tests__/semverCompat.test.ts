/**
 * src/server/__tests__/semverCompat.test.ts — Real tests for the semver
 * compatibility engine and its HTTP endpoint.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  parseVersion,
  compareVersions,
  satisfiesRange,
  evaluateCompatibility,
} from "../semverCompat.js";

test("parseVersion handles release and prerelease", () => {
  assert.deepEqual(parseVersion("1.2.3"), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: [],
  });
  assert.deepEqual(parseVersion("2.0.0-rc.1"), {
    major: 2,
    minor: 0,
    patch: 0,
    prerelease: ["rc", "1"],
  });
  assert.equal(parseVersion("not-a-version"), null);
});

test("compareVersions orders correctly", () => {
  const a = parseVersion("1.2.3")!;
  const b = parseVersion("1.2.4")!;
  const c = parseVersion("2.0.0")!;
  assert.equal(compareVersions(a, b), -1);
  assert.equal(compareVersions(b, a), 1);
  assert.equal(compareVersions(a, parseVersion("1.2.3")!), 0);
  assert.equal(compareVersions(a, c), -1);
  // prerelease < release of same version
  assert.equal(compareVersions(parseVersion("1.2.3-rc.1")!, parseVersion("1.2.3")!), -1);
});

test("satisfiesRange handles caret/tilde/exact/two-sided", () => {
  assert.equal(satisfiesRange(parseVersion("1.4.0")!, "^1.2.0"), true);
  assert.equal(satisfiesRange(parseVersion("2.0.0")!, "^1.2.0"), false);
  assert.equal(satisfiesRange(parseVersion("1.2.9")!, "~1.2.0"), true);
  assert.equal(satisfiesRange(parseVersion("1.3.0")!, "~1.2.0"), false);
  assert.equal(satisfiesRange(parseVersion("1.2.3")!, "1.2.3"), true);
  assert.equal(satisfiesRange(parseVersion("1.2.4")!, "1.2.3"), false);
  assert.equal(satisfiesRange(parseVersion("1.5.0")!, ">=1.2.0 <2.0.0"), true);
  assert.equal(satisfiesRange(parseVersion("2.0.0")!, ">=1.2.0 <2.0.0"), false);
});

test("evaluateCompatibility fails when engine out of range", () => {
  const r = evaluateCompatibility({
    engineVersion: "1.1.0",
    engineRange: "^1.2.0",
  });
  assert.equal(r.compatible, false);
  assert.ok(r.reasons.length > 0);
});

test("evaluateCompatibility passes for in-range engine with satisfied peers", () => {
  const r = evaluateCompatibility({
    engineVersion: "1.4.0",
    engineRange: "^1.2.0",
    peers: { foo: { version: "2.3.1", range: "^2.0.0" } },
  });
  assert.equal(r.compatible, true);
  assert.equal(r.reasons.length, 0);
});

test("evaluateCompatibility fails when a peer is out of range", () => {
  const r = evaluateCompatibility({
    engineVersion: "1.4.0",
    engineRange: "^1.2.0",
    peers: { foo: { version: "1.9.0", range: "^2.0.0" } },
  });
  assert.equal(r.compatible, false);
  assert.ok(r.reasons.some((x) => x.includes("peer foo")));
});

test("HTTP endpoint returns compatible:true for a valid request", async () => {
  const router = express.Router();
  const mod = await import("../features/feat-marketplace-compat.js");
  (mod.default as (r: express.Router) => void)(router);
  const app = express();
  app.use(router);
  const srv = app.listen(0);
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}/api/marketplace/compat/v2`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        engineVersion: "1.4.0",
        engineRange: "^1.2.0",
        peers: { foo: { version: "2.3.1", range: "^2.0.0" } },
      }),
    });
    const json = (await res.json()) as { compatible: boolean };
    assert.equal(res.status, 200);
    assert.equal(json.compatible, true);
  } finally {
    srv.close();
  }
});
