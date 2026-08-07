import { describe, test, expect } from "bun:test";
import { registry } from "../mock-auth";

describe("mock-auth", () => {
  test("login returns token and user", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/auth/login", query: {}, headers: {}, body: { email: "cto@forgeos.local", password: "x" } });
    expect(res.status).toBe(200);
    expect((res.body as any).token).toBeTruthy();
    expect((res.body as any).user.role).toBe("cto");
  });

  test("rejects missing credentials", async () => {
    const res = await registry.handle({ method: "POST", path: "/api/auth/login", query: {}, headers: {}, body: {} });
    expect(res.status).toBe(400);
  });

  test("refresh returns new token", async () => {
    const login = await registry.handle({ method: "POST", path: "/api/auth/login", query: {}, headers: {}, body: { email: "ceo@forgeos.local", password: "x" } });
    const token = (login.body as any).token;
    const res = await registry.handle({ method: "POST", path: "/api/auth/refresh", query: {}, headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect((res.body as any).token).toBeTruthy();
  });
});
