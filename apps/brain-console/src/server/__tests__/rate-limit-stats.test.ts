import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRuntime } from "../runtime";
import express from "express";
import http from "node:http";

// Verifies the GET /api/rate-limit/stats endpoint aggregates the per-IP
// request counter (populated by server.ts's logging middleware) into totals
// and a sorted top-IP list.
describe("apps/brain-console/src/server runtime /api/rate-limit/stats", () => {
  let server: http.Server;
  let port = 0;
  const requestCounts = new Map<string, number>([
    ["127.0.0.1", 7],
    ["10.0.0.5", 3],
    ["::1", 1],
  ]);

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(await createRuntime({ requestCounts }));
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as any).port;
  });

  after(() => server.close());

  const request = (
    method: string,
    path: string
  ): Promise<{ status: number; body: any }> =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: { "content-type": "application/json" },
        },
        (res) => {
          let data = "";
          res.on("data", (c: string) => (data += c));
          res.on("end", () => {
            let parsed: any = {};
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch {
              /* keep raw */
            }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        }
      );
      req.on("error", reject);
      req.end();
    });

  it("GET /api/rate-limit/stats -> 200 with per-IP counts and totals", async () => {
    const { status, body } = await request("GET", "/api/rate-limit/stats");
    assert.strictEqual(status, 200, "expected 200 for /api/rate-limit/stats");
    assert.strictEqual(body.total, 11, "total should sum all per-IP counts");
    assert.strictEqual(body.uniqueIps, 3, "uniqueIps should equal distinct IPs");
    assert.strictEqual(body.perIp["127.0.0.1"], 7);
    assert.strictEqual(body.perIp["10.0.0.5"], 3);
    assert.ok(Array.isArray(body.topIps), "topIps should be an array");
    assert.strictEqual(body.topIps.length, 3);
    assert.strictEqual(body.topIps[0].ip, "127.0.0.1", "top IP should be highest count");
    assert.strictEqual(body.topIps[0].count, 7);
  });

  it("GET /api/rate-limit/stats -> empty totals with no counter data", async () => {
    const app = express();
    app.use(express.json());
    app.use(await createRuntime());
    const srv = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => srv.on("listening", () => resolve()));
    const p = (srv.address() as any).port;
    try {
      const { status, body } = await new Promise<{ status: number; body: any }>(
        (resolve, reject) => {
          const req = http.request(
            { hostname: "127.0.0.1", port: p, path: "/api/rate-limit/stats", method: "GET" },
            (res) => {
              let data = "";
              res.on("data", (c: string) => (data += c));
              res.on("end", () => {
                let parsed: any = {};
                try {
                  parsed = data ? JSON.parse(data) : {};
                } catch {
                  /* keep raw */
                }
                resolve({ status: res.statusCode ?? 0, body: parsed });
              });
            }
          );
          req.on("error", reject);
          req.end();
        }
      );
      assert.strictEqual(status, 200);
      assert.strictEqual(body.total, 0);
      assert.strictEqual(body.uniqueIps, 0);
      assert.deepStrictEqual(body.topIps, []);
    } finally {
      srv.close();
    }
  });
});
