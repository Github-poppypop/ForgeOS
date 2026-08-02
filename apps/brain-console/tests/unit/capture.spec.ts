// tests/unit/capture.spec.ts — integration tests for /api/capture path-traversal validation
// Uses Bun's built-in test runner (bun:test). Spins up server.ts on a random port.

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const PORT = 7777 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;

describe("/api/capture validation", () => {
  let server: any;

  beforeAll(async () => {
    const env = {
      ...process.env,
      GBRAIN_HOME: "C:\ForgeOS",
      GBRAIN_CWD: "C:\Users\pop\forge-gbrain",
      OLLAMA_BASE_URL: "http://localhost:11434/v1",
      GBRAIN_EMBEDDING_DIMENSIONS: "1024",
      PORT: String(PORT),
      CONSOLE_TOKEN: "",
    };
    delete env.DATABASE_URL;

    server = spawn("bun", ["run", "server.ts"], {
      cwd: process.cwd(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    await new Promise<void>((resolve) => {
      const check = () => {
        fetch(`${BASE}/api/health`)
          .then((r) => r.ok && resolve())
          .catch(() => setTimeout(check, 200));
      };
      setTimeout(check, 500);
    });
  });

  afterAll(async () => {
    if (server?.pid) {
      server.kill("SIGTERM");
      await new Promise((r) => server.on("exit", r));
    }
  });

  test("rejects ../etc/passwd with 400", async () => {
    const res = await fetch(`${BASE}/api/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "../etc/passwd", type: "page", body: {} }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid slug/);
  });

  test("rejects slugs with / separator", async () => {
    const res = await fetch(`${BASE}/api/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "decisions/../etc/passwd", type: "page", body: {} }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid slug/);
  });

  test("rejects slugs with backslash", async () => {
    const res = await fetch(`${BASE}/api/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "decisions\..\passwd", type: "page", body: {} }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid slug/);
  });

  test("accepts valid slug", async () => {
    const res = await fetch(`${BASE}/api/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "decisions/test-${PORT}", type: "page", body: { title: "test" } }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
