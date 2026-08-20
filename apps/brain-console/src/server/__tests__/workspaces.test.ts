import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRuntime } from "../runtime";
import express from "express";
import http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Coverage for the persistent shared-workspaces API backed by data/workspaces.json.
describe("apps/brain-console/src/server/runtime workspaces API", () => {
  let server: http.Server;
  let port = 0;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const WORKSPACES_FILE = path.resolve(__dirname, "..", "..", "..", "data", "workspaces.json");

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
    // leave the data dir clean for subsequent runs
    try {
      if (fs.existsSync(WORKSPACES_FILE)) fs.writeFileSync(WORKSPACES_FILE, "[]");
    } catch {
      // ignore
    }
  });

  const request = (
    method: string,
    route: string,
    body?: unknown
  ): Promise<{ status: number; body: any }> =>
    new Promise((resolve, reject) => {
      const url = new URL(route, `http://127.0.0.1:${port}/`);
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
              // keep raw
            }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        }
      );
      req.on("error", reject);
      if (body !== undefined) req.write(JSON.stringify(body));
      req.end();
    });

  it("GET /api/workspaces -> 200 with ok + workspaces array", async () => {
    const { status, body } = await request("GET", "/api/workspaces");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
    assert.ok(Array.isArray(body.workspaces));
  });

  it("POST /api/workspaces requires a name", async () => {
    const { status } = await request("POST", "/api/workspaces", {});
    assert.strictEqual(status, 400);
  });

  it("POST then GET a workspace and add a member + feed", async () => {
    const created = await request("POST", "/api/workspaces", { name: "War Room " + Date.now() });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.ok, true);
    const ws = created.body.workspace;
    assert.ok(typeof ws.id === "string" && ws.id.length > 0);
    assert.strictEqual(ws.name.startsWith("War Room"), true);
    assert.deepStrictEqual(ws.members, []);

    const got = await request("GET", "/api/workspaces/" + ws.id);
    assert.strictEqual(got.status, 200);
    assert.strictEqual(got.body.ok, true);
    assert.strictEqual(got.body.workspace.id, ws.id);

    const joined = await request("POST", "/api/workspaces/" + ws.id + "/members", {
      name: "Scout-7",
      action: "join",
    });
    assert.strictEqual(joined.status, 200);
    assert.strictEqual(joined.body.ok, true);
    assert.strictEqual(joined.body.members.length, 1);
    assert.strictEqual(joined.body.members[0].name, "Scout-7");

    const fed = await request("POST", "/api/workspaces/" + ws.id + "/feed", {
      agent: "Scout-7",
      text: "analyzed telemetry",
    });
    assert.strictEqual(fed.status, 201);
    assert.strictEqual(fed.body.ok, true);

    const feed = await request("GET", "/api/workspaces/" + ws.id + "/feed");
    assert.strictEqual(feed.status, 200);
    assert.strictEqual(feed.body.ok, true);
    assert.strictEqual(feed.body.feed.length, 1);
    assert.strictEqual(feed.body.feed[0].agent, "Scout-7");

    const unknown = await request("GET", "/api/workspaces/" + ws.id + "-nope");
    assert.strictEqual(unknown.status, 404);
  });
});
