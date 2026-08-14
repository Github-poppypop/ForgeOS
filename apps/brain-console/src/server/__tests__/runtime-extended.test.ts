import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRuntime } from "../runtime";
import express from "express";

describe("apps/brain-console/src/server/runtime extended routes", () => {
  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use(createRuntime());
    return app;
  };

  const request = (
    app: express.Express,
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; body: any }> =>
    new Promise((resolve, reject) => {
      const server = app.listen(0, "127.0.0.1", async () => {
        const port = (server.address() as any).port;
        try {
          const url = new URL(path, `http://127.0.0.1:${port}/`);
          const http = await import("node:http");
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
                server.close();
                let parsed: any = data;
                try {
                  parsed = data ? JSON.parse(data) : {};
                } catch {
                  // keep raw body for non-JSON assertions
                }
                resolve({ status: res.statusCode ?? 0, body: parsed });
              });
            }
          );
          req.on("error", (err) => {
            server.close();
            reject(err);
          });
          if (body !== undefined) req.write(JSON.stringify(body));
          req.end();
        } catch (err) {
          server.close();
          reject(err);
        }
      });
    });

  it("exports createRuntime", () => {
    assert.strictEqual(typeof createRuntime, "function");
  });

  it("creates a router with standard express middleware", async () => {
    const runtime = createRuntime();
    assert.ok(runtime, "runtime middleware is defined");
  });

  it("serves request logs from /api/logs", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/logs");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.logs));
    assert.ok(typeof body.count === "number");
  });

  it("serves derived metrics from /api/metrics", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/metrics");
    assert.strictEqual(status, 200);
    assert.ok(typeof body.total === "number");
    assert.ok(typeof body.errors === "number");
    assert.ok(typeof body.avgMs === "number");
    assert.ok(Array.isArray(body.byRoute));
  });

  it("authenticates via /api/auth/login", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "POST", "/api/auth/login", {
      username: "test",
      password: "test",
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
    assert.ok(typeof body.token === "string");
    assert.deepEqual(body.user, { username: "test", role: "operator" });
  });

  it("rejects login when fields are missing", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "POST", "/api/auth/login", {});
    assert.strictEqual(status, 400);
    assert.strictEqual(body.error, "username and password required");
  });

  it("returns store state from /api/state", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/state");
    assert.strictEqual(status, 200);
    assert.ok(body.store);
    assert.ok(typeof body.generatedAt === "string");
  });

  it("restores with verified-payload guard", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "POST", "/api/restore", {});
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.restored, false);
  });

  it("captures pages in batch via /api/capture/batch", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "POST", "/api/capture/batch", {
      items: [
        { slug: "batch/a", type: "note", title: "A", body: "a-body" },
        { slug: "batch/b", type: "note", title: "B", body: "b-body" },
      ],
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(body.created, 2);
    assert.strictEqual(body.pages[0].slug, "batch/a");
    assert.strictEqual(body.pages[1].slug, "batch/b");
  });

  it("imports json payloads via /api/import", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "POST", "/api/import", { format: "json" });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.format, "json");
  });

  it("rejects unsupported import format", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "POST", "/api/import", { format: "xml" });
    assert.strictEqual(status, 400);
    assert.strictEqual(body.error, "unsupported import format");
  });

  it("exports a page via /api/export/:slug", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/export/types/roles");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.export, "json");
    assert.strictEqual(body.slug, "types/roles");
    assert.strictEqual(body.page.title, "C-Suite Roles");
  });

  it("returns 404 when exported page is missing", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/export/missing-slug");
    assert.strictEqual(status, 404);
    assert.strictEqual(body.error, "page not found");
  });

  it("returns remote federation nodes via /api/federation/remote", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/federation/remote");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.root, "ForgeOS");
    assert.ok(Array.isArray(body.nodes));
    assert.ok(body.nodes[0].remote);
  });

  it("returns agent workflows via /api/agent/:id/workflows", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/agent/cto/workflows");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.agent, "cto");
    assert.ok(Array.isArray(body.workflows));
  });

  it("returns agent messages via /api/agent/:id/messages", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/agent/cto/messages");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.agent, "cto");
    assert.ok(body.messages.length >= 1);
  });

  it("returns agent metrics via /api/agent/:id/metrics", async () => {
    const app = buildApp();
    const { status, body } = await request(app, "GET", "/api/agent/cto/metrics");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.agent, "cto");
    assert.ok(typeof body.successRate === "number");
  });
});
