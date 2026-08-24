/**
 * src/server/__tests__/graphql.test.ts — Real tests for the GraphQL feature
 * (feat-graphql.ts): depth/complexity guard math + the limits/query endpoints.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerGraphql from "../features/feat-graphql.js";
import { computeDepth, computeComplexity } from "../features/feat-graphql.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  registerGraphql(app as unknown as import("express").Router);
  return app;
}

test("computeDepth counts brace nesting", () => {
  assert.equal(computeDepth("{ a { b { c } } }"), 3);
  assert.equal(computeDepth("{ a }"), 1);
  assert.equal(computeDepth("query { a { b { c { d } } } }"), 4);
});

test("computeComplexity counts field selections", () => {
  // depth-1 'a' + depth-2 'b' + depth-2 'c' => 3 field nodes.
  assert.equal(computeComplexity("{ a { b c } }"), 3);
});

test("GET /api/graphql/limits returns depth + complexity caps", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/graphql/limits`);
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.equal(typeof j.maxDepth, "number");
    assert.equal(typeof j.maxComplexity, "number");
  } finally {
    srv.close();
  }
});

test("POST /api/graphql executes a valid query", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ limits { maxDepth } }" }),
    });
    assert.equal(r.status, 200);
    const j = (await r.json()) as any;
    assert.ok(j.data, "returns data");
    assert.equal(j.data.limits.maxDepth, 8);
  } finally {
    srv.close();
  }
});

test("POST /api/graphql rejects an empty query with 400", async () => {
  const app = makeApp();
  const srv = app.listen(0);
  const port = (srv.address() as any).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "" }),
    });
    assert.equal(r.status, 400);
  } finally {
    srv.close();
  }
});
