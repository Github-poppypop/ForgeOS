import { describe, test, expect } from "bun:test";
import { registry } from "../mock-storage";

describe("mock-storage", () => {
  test("upload creates file", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/storage/upload", query: {}, headers: {}, body: { name: "a.txt", size: 5 } });
    expect(res.status).toBe(201);
    expect((res.body as any).id).toBeTruthy();
  });

  test("lists files", async () => {
    const res = await registry.handle({ method: "GET", path: "/api/storage", query: {}, headers: {} });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as any).files)).toBe(true);
  });

  test("deletes file", async () => {
    const create = await registry.handle({ method: "POST", path: "/api/storage/upload", query: {}, headers: {}, body: { name: "del.txt", size: 1 } });
    const id = (create.body as any).id;
    const res = await registry.handle({ method: "DELETE", path: `/api/storage/${id}`, query: {}, headers: {} });
    expect(res.status).toBe(200);
    expect((res.body as any).ok).toBe(true);
  });
});
