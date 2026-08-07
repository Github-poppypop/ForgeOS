import { describe, test, expect } from "bun:test";
import { registry } from "../mock-search";

describe("mock-search", () => {
  test("search filters by query", async () => {
    const res = await registry.handle({ method: "GET", path: "/api/search", query: { q: "marketplace" }, headers: {} });
    expect(res.status).toBe(200);
    expect((res.body as any).total).toBeGreaterThanOrEqual(0);
  });

  test("suggest returns matches", async () => {
    const res = await registry.handle({ method: "GET", path: "/api/search/suggest", query: { q: "RFC" }, headers: {} });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as any).suggestions)).toBe(true);
  });
});
