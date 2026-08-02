// tests/unit/api-extended.spec.ts — extended unit tests for src/lib/api.js
// Covers all api.* endpoints with mocked fetch

import { describe, test, expect, beforeEach } from "bun:test";
import { api } from "../../src/lib/api.js";

function makeMockResponse(body: unknown, status = 200, statusText = "OK") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

describe("api endpoints", () => {
  let capturedUrl: string | null = null;
  let capturedInit: RequestInit | null = null;

  beforeEach(() => {
    capturedUrl = null;
    capturedInit = null;
  });

  function mockFetch(resp: any) {
    // @ts-ignore
    globalThis.fetch = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return resp;
    };
  }

  test("api.roles() hits /api/roles", async () => {
    const data = { roles: [{ slug: "exec/ceo", role: "CEO" }] };
    mockFetch(makeMockResponse(data));
    const result = await api.roles();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/roles");
  });

  test("api.page() encodes slug", async () => {
    const data = { slug: "decisions/test", body: "hello" };
    mockFetch(makeMockResponse(data));
    const result = await api.page("decisions/test");
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/page/decisions%2Ftest");
  });

  test("api.search() hits /api/search with q param", async () => {
    const data = { query: "test", raw: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.search("test");
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/search?q=test");
  });

  test("api.schema() hits /api/schema", async () => {
    const data = { active: "forgeos", types: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.schema();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/schema");
  });

  test("api.audit() hits /api/audit", async () => {
    const data = { raw: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.audit();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/audit");
  });

  test("api.federation() hits /api/federation", async () => {
    const data = { root: "ForgeOS", children: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.federation();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/federation");
  });

  test("api.gov() hits /api/governance", async () => {
    const data = { tree: { constitution: [] } };
    mockFetch(makeMockResponse(data));
    const result = await api.gov();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/governance");
  });

  test("api.vault() hits /api/vault", async () => {
    const data = { base: "C:\ForgeOS\vault", files: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.vault();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/vault");
  });

  test("api.missions() hits /api/missions", async () => {
    const data = { missions: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.missions();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/missions");
  });

  test("api.advanceMission() PATCHes /api/missions/:id", async () => {
    const data = { ok: true };
    mockFetch(makeMockResponse(data));
    const result = await api.advanceMission("RFC-0000", { status: "approved" });
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/missions/RFC-0000");
    expect(capturedInit?.method).toBe("PATCH");
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ status: "approved" });
  });

  test("api.dispatchAgent() POSTs to /api/agent/dispatch", async () => {
    const data = { ok: true };
    mockFetch(makeMockResponse(data));
    const result = await api.dispatchAgent("RFC-0000", "agent-1");
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/agent/dispatch");
    expect(capturedInit?.method).toBe("POST");
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ missionId: "RFC-0000", agent: "agent-1" });
  });

  test("api.capture() POSTs to /api/capture with correct body", async () => {
    const data = { ok: true };
    mockFetch(makeMockResponse(data));
    const result = await api.capture("decisions/test", "page", { title: "Hello" });
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/capture");
    expect(capturedInit?.method).toBe("POST");
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ slug: "decisions/test", type: "page", body: { title: "Hello" } });
  });

  test("api.embed() POSTs to /api/embed", async () => {
    const data = { ok: true };
    mockFetch(makeMockResponse(data));
    const result = await api.embed();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/embed");
    expect(capturedInit?.method).toBe("POST");
  });

  test("api.timeline() hits /api/timeline", async () => {
    const data = { events: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.timeline();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/timeline");
  });

  test("api.ledger() hits /api/ledger", async () => {
    const data = { entries: [] };
    mockFetch(makeMockResponse(data));
    const result = await api.ledger();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/ledger");
  });

  test("api.org() hits /api/org", async () => {
    const data = { org: {} };
    mockFetch(makeMockResponse(data));
    const result = await api.org();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/org");
  });
});
