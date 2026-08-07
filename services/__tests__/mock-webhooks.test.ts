import { describe, test, expect } from "bun:test";
import { registry } from "../mock-webhooks";

describe("mock-webhooks", () => {
  test("inbound accepts event", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/webhooks/inbound", query: {}, headers: {}, body: { event: "test" } });
    expect(res.status).toBe(202);
    expect((res.body as any).accepted).toBe(true);
  });

  test("lists deliveries", async () => {
    const res = await registry.handle({ method: "GET", path: "/api/webhooks/deliveries", query: {}, headers: {} });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as any).deliveries)).toBe(true);
  });
});
