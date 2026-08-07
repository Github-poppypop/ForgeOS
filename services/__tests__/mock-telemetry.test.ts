import { describe, test, expect } from "bun:test";
import { registry } from "../mock-telemetry";

describe("mock-telemetry", () => {
  test("records metric and lists metrics", async () => {
    const create = await registry.handle({ method: "POST", path: "/api/telemetry/metric", query: {}, headers: {}, body: { name: "cpu", value: 0.5 } });
    expect(create.status).toBe(202);
    const list = await registry.handle({ method: "GET", path: "/api/telemetry/metrics", query: {}, headers: {} });
    expect(list.status).toBe(200);
    expect((list.body as any).metrics.length).toBeGreaterThanOrEqual(1);
  });

  test("records event and lists events", async () => {
    const create = await registry.handle({ method: "POST", path: "/api/telemetry/event", query: {}, headers: {}, body: { name: "click", properties: { page: "home" } } });
    expect(create.status).toBe(202);
    const list = await registry.handle({ method: "GET", path: "/api/telemetry/events", query: {}, headers: {} });
    expect(list.status).toBe(200);
    expect((list.body as any).events.length).toBeGreaterThanOrEqual(1);
  });
});
