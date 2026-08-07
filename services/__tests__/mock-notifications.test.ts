import { describe, test, expect } from "bun:test";
import { registry } from "../mock-notifications";

describe("mock-notifications", () => {
  test("creates and lists notifications", async () => {
    const create = await registry.handle({ method: "POST", path: "/api/notifications", query: {}, headers: {}, body: { title: "Hello", body: "World" } });
    expect(create.status).toBe(201);
    const list = await registry.handle({ method: "GET", path: "/api/notifications", query: {}, headers: {} });
    expect(list.status).toBe(200);
    expect((list.body as any).unread).toBeGreaterThanOrEqual(1);
  });
});
