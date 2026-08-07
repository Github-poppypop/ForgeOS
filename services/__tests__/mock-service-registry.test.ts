import { describe, test, expect } from "bun:test";
import { registry } from "../mock-service-registry";

describe("mock-service-registry", () => {
  test("registers and handles GET", async () => {
    registry.register("GET", "/api/ping", () => ({ status: 200, body: { ok: true } }));
    const res = await registry.handle({ method: "GET", path: "/api/ping", query: {}, headers: {} });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test("returns 404 for unknown route", async () => {
    const res = await registry.handle({ method: "GET", path: "/api/unknown", query: {}, headers: {} });
    expect(res.status).toBe(404);
  });

  test("supports middleware rejection", async () => {
    registry.use(() => ({ status: 401, body: { error: "unauthorized" } }));
    const res = await registry.handle({ method: "GET", path: "/api/ping", query: {}, headers: {} });
    expect(res.status).toBe(401);
  });
});
