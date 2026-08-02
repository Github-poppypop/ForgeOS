// tests/unit/api.spec.ts — unit tests for src/lib/api.js
// Uses Bun's built-in test runner (bun:test). No external deps required.

import { describe, test, expect } from "bun:test";
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

describe("api.req()", () => {
  test("success path resolves with parsed JSON", async () => {
    const data = { ok: true, id: 42 };
    const resp = makeMockResponse(data);
    let capturedUrl: string | null = null;
    let capturedInit: RequestInit | null = null;

    // @ts-ignore
    globalThis.fetch = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return resp;
    };

    const result = await api.status();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/status");
  });

  test("HTTP error throws with status and response text", async () => {
    const errBody = "Not Found";
    const resp = makeMockResponse(errBody, 404, "Not Found");

    // @ts-ignore
    globalThis.fetch = async () => resp;

    let threw = false;
    try {
      await api.status();
    } catch (e: any) {
      threw = true;
      expect(e.message).toContain("HTTP 404");
      expect(e.message).toContain("Not Found");
    }
    expect(threw).toBe(true);
  });
});

describe("api.status()", () => {
  test("hits /api/status and returns JSON payload", async () => {
    const data = { status: "ok", brain: "connected" };
    const resp = makeMockResponse(data);
    let capturedUrl: string | null = null;

    // @ts-ignore
    globalThis.fetch = async (url: string) => {
      capturedUrl = url;
      return resp;
    };

    const result = await api.status();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/status");
  });
});

describe("api.gov()", () => {
  test("hits /api/governance and returns JSON payload", async () => {
    const data = { roles: [], missions: [] };
    const resp = makeMockResponse(data);
    let capturedUrl: string | null = null;

    // @ts-ignore
    globalThis.fetch = async (url: string) => {
      capturedUrl = url;
      return resp;
    };

    const result = await api.gov();
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/governance");
  });
});

describe("api.capture()", () => {
  test("POSTs slug/type/body to /api/capture and returns JSON", async () => {
    const data = { ok: true, slug: "decisions/test" };
    const resp = makeMockResponse(data);
    let capturedUrl: string | null = null;
    let capturedInit: RequestInit | null = null;

    // @ts-ignore
    globalThis.fetch = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return resp;
    };

    const result = await api.capture("decisions/test", "page", { title: "Hello" });
    expect(result).toEqual(data);
    expect(capturedUrl).toBe("/api/capture");
    expect(capturedInit?.method).toBe("POST");

    const sentBody = JSON.parse(capturedInit?.body as string);
    expect(sentBody).toEqual({ slug: "decisions/test", type: "page", body: { title: "Hello" } });
  });
});
