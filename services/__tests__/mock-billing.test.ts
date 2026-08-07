import { describe, test, expect } from "bun:test";
import { registry } from "../mock-billing";

describe("mock-billing", () => {
  test("lists plans", async () => {
    const res = await registry.handle({ method: "GET", path: "/api/billing/plans", query: {}, headers: {} });
    expect(res.status).toBe(200);
    expect((res.body as any).plans.length).toBeGreaterThan(0);
  });

  test("creates invoice", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/billing/invoices", query: {}, headers: {}, body: { planId: "team" } });
    expect(res.status).toBe(201);
    expect((res.body as any).invoice.status).toBe("paid");
  });

  test("records usage", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/billing/usage", query: {}, headers: {}, body: { metric: "requests", value: 5 } });
    expect(res.status).toBe(202);
    expect((res.body as any).accepted).toBe(true);
  });
});
