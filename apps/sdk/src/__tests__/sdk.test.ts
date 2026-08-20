/**
 * src/__tests__/sdk.test.ts — Real tests for the ForgeOS external-app SDK
 * (apps/sdk/src/index.ts): plugin manifest -> route handlers (405 on method
 * mismatch, 200 payload on match) and client URL construction (baseUrl
 * normalization + apiPath versioning). No network: fetch is stubbed and route
 * handlers receive a minimal request object.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createForgeOSClient, defineForgeOSPlugin } from "../index.js";

test("defineForgeOSPlugin maps routes to handlers returning 200 on matching method", async () => {
  const plugin = defineForgeOSPlugin({
    name: "demo",
    version: "1.0.0",
    routes: { "/hello": "get" },
  });
  const handler = (plugin.default as any).routes["/hello"];
  assert.equal(typeof handler, "function", "handler created");
  const res = await handler({ method: "GET" } as Request);
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.plugin, true);
  assert.equal(body.path, "/hello");
  assert.equal(body.method, "get");
  assert.equal(body.ok, true);
});

test("plugin route handler returns 405 when the method mismatches", async () => {
  const plugin = defineForgeOSPlugin({ name: "demo", version: "1.0.0", routes: { "/x": "post" } });
  const handler = (plugin.default as any).routes["/x"];
  const res = await handler({ method: "GET" } as Request);
  assert.equal(res.status, 405);
  const body = (await res.json()) as any;
  assert.ok(body.error.includes("POST required"), "explains required method");
});

test("plugin with no routes yields undefined routes", () => {
  const plugin = defineForgeOSPlugin({ name: "bare", version: "0.1.0" });
  assert.equal((plugin.default as any).routes, undefined);
  assert.equal((plugin.default as any).name, "bare");
});

test("client normalizes baseUrl and builds versioned api path", async () => {
  let captured = "";
  (globalThis as any).fetch = async (url: string) => {
    captured = url;
    return { ok: true, status: 200, json: async () => ({ ok: true, ts: 1 }) } as any;
  };
  const client = createForgeOSClient({ baseUrl: "http://brain.local//", apiVersion: "v2" });
  const out = await client.health();
  assert.equal(out.ok, true);
  assert.ok(captured.endsWith("/api/v2/health"), `url versioned+normalized: ${captured}`);
  assert.ok(!captured.includes("//api"), "no double slash from baseUrl");
});
