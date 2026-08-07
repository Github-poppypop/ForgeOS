import { describe, test, expect } from "bun:test";
import { registry } from "../mock-integrations";

describe("mock-integrations", () => {
  test("starts oauth flow", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/integrations/slack/oauth/start", query: {}, headers: {} });
    expect(res.status).toBe(200);
    expect((res.body as any).provider).toBe("slack");
  });

  test("connects integration via callback", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/integrations/slack/oauth/callback", query: {}, headers: {}, body: { code: "abc" } });
    expect(res.status).toBe(200);
    expect((res.body as any).integration.connected).toBe(true);
  });

  test("lists integrations", async () => {
    const res = await registry.handle({ method: "GET", path: "/api/integrations", query: {}, headers: {} });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as any).integrations)).toBe(true);
  });
});
