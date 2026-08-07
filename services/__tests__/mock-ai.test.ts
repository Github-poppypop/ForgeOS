import { describe, test, expect } from "bun:test";
import { registry } from "../mock-ai";

describe("mock-ai", () => {
  test("complete returns completion", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/ai/complete", query: {}, headers: {}, body: { prompt: "hello" } });
    expect(res.status).toBe(200);
    expect((res.body as any).completion).toContain("hello");
  });

  test("embed returns numeric vector", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/ai/embed", query: {}, headers: {}, body: { text: "abc" } });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as any).embedding)).toBe(true);
    expect((res.body as any).dimensions).toBe((res.body as any).embedding.length);
  });

  test("rerank returns scored results", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/ai/rerank", query: {}, headers: {}, body: { query: "q", documents: ["a", "b"] } });
    expect(res.status).toBe(200);
    expect((res.body as any).results.length).toBe(2);
  });
});
