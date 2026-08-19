import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRuntime } from "../runtime";
import express from "express";
import http from "node:http";

// Real route-contract coverage for the user-facing Brain Console API.
// Mounts the actual runtime router (same surface the production server exposes)
// and asserts every GET/POST route the UI depends on returns a successful,
// well-formed JSON response. This replaces the orphaned bun:test specs that
// asserted a deleted server.ts surface and were never executed by `npm test`.

describe("apps/brain-console/src/server/runtime user-facing route contract", () => {
  let server: http.Server;
  let port = 0;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(await createRuntime());
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as any).port;
  });

  after(() => {
    server.close();
  });

  const request = (
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; body: any; contentType: string }> =>
    new Promise((resolve, reject) => {
      const url = new URL(path, `http://127.0.0.1:${port}/`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers: { "content-type": "application/json" },
        },
        (res: any) => {
          let data = "";
          res.on("data", (chunk: string) => (data += chunk));
          res.on("end", () => {
            let parsed: any = data;
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch {
              // keep raw body for non-JSON assertions
            }
            resolve({
              status: res.statusCode ?? 0,
              body: parsed,
              contentType: String(res.headers["content-type"] ?? ""),
            });
          });
        }
      );
      req.on("error", reject);
      if (body !== undefined) req.write(JSON.stringify(body));
      req.end();
    });

  const GET_ROUTES = [
    "/api/health",
    "/api/health/detailed",
    "/api/status",
    "/api/roles",
    "/api/search",
    "/api/schema",
    "/api/audit",
    "/api/federation",
    "/api/federation/remote",
    "/api/governance",
    "/api/vault",
    "/api/missions",
    "/api/timeline",
    "/api/ledger",
    "/api/compliance",
    "/api/plugins",
    "/api/mcp",
    "/api/marketplace",
    "/api/workflows",
    "/api/monitoring",
    "/api/projects",
    "/api/poolleague",
    "/api/webhooks",
    "/api/self-improve",
    "/api/settings",
    "/api/config",
    "/api/rate-limit/status",
    "/api/embed",
    "/api/developers",
    "/api/apps",
    "/api/openapi",
    "/api/logs",
    "/api/metrics",
    "/api/state",
    "/api/agent/self-improve/status",
    "/api/agent/1/workflows",
    "/api/agent/1/messages",
    "/api/agent/1/metrics",
    "/api/agent/memory",
  ];

  for (const route of GET_ROUTES) {
    it(`GET ${route} -> 200 application/json`, async () => {
      const { status, contentType } = await request("GET", route);
      assert.strictEqual(status, 200, `expected 200 for ${route}, got ${status}`);
      assert.match(contentType, /application\/json/);
    });
  }

  it("POST /api/auth/login -> 200 with token", async () => {
    const { status, body } = await request("POST", "/api/auth/login", {
      username: "operator",
      password: "secret",
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
    assert.ok(typeof body.token === "string");
  });

  it("POST /api/capture -> 201 created", async () => {
    const { status } = await request("POST", "/api/capture", {
      slug: `contract/probe-${Date.now()}`,
      type: "note",
      title: "contract probe",
      body: "probe",
    });
    assert.strictEqual(status, 201);
  });

  it("POST /api/feedback -> 201 accepted", async () => {
    const { status } = await request("POST", "/api/feedback", {
      comment: "contract probe",
      rating: 5,
    });
    assert.strictEqual(status, 201);
  });

  it("POST /api/self-improve/learning-loop -> 200", async () => {
    const { status, body } = await request("POST", "/api/self-improve/learning-loop", {});
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
  });

  it("POST /api/agent/memory -> 201 created", async () => {
    const key = `probe-${Date.now()}`;
    const { status } = await request("POST", "/api/agent/memory", { key, value: "contract probe" });
    assert.strictEqual(status, 201);
  });

  it("GET /api/agent/memory returns persisted entries", async () => {
    const key = `probe-${Date.now()}`;
    await request("POST", "/api/agent/memory", { key, value: "contract probe" });
    const { status, body } = await request("GET", "/api/agent/memory");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.memory));
    assert.ok(body.memory.some((m: any) => m.key === key));
  });

  it("GET /api/agent/memory/:key returns entry or 404", async () => {
    const { status, body } = await request("GET", "/api/agent/memory/nonexistent-key-xyz");
    assert.strictEqual(status, 404);
    assert.strictEqual(body.error, "memory key not found");
  });

  it("POST /api/metrics-style telemetry -> 200", async () => {
    const { status, body } = await request("POST", "/api/telemetry", {
      event: "page_view",
      route: "/dashboard",
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
  });
});
