import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntime } from "../runtime";

// Real HTTP coverage for the plugin marketplace registry: discovery
// (GET /api/marketplace), publish (POST /api/marketplace) and install
// (POST /api/marketplace/:id/install), backed by data/registry.json.
// Each test publishes a uniquely-named plugin so the suite is repeatable
// against a persisted registry file.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = path.resolve(__dirname, "..", "..", "..", "data", "registry.json");

describe("apps/brain-console marketplace plugin registry", () => {
  let server: http.Server;
  let port = 0;

  before(async () => {
    const app = express();
    app.use(await createRuntime());
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as any).port;
  });

  after(() => {
    server.close();
  });

  const request = (
    method: string,
    urlPath: string,
    body?: unknown
  ): Promise<{ status: number; body: any; contentType: string }> =>
    new Promise((resolve, reject) => {
      const url = new URL(urlPath, `http://127.0.0.1:${port}/`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers: { "content-type": "application/json" },
        },
        (res: any) => {
          let data = "";
          res.on("data", (chunk: string) => (data += chunk));
          res.on("end", () => {
            let parsed: any = data;
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch {
              // keep raw body for non-JSON assertions
            }
            resolve({
              status: res.statusCode ?? 0,
              body: parsed,
              contentType: String(res.headers["content-type"] ?? ""),
            });
          });
        }
      );
      req.on("error", reject);
      if (body !== undefined) req.write(JSON.stringify(body));
      req.end();
    });

  const uniqueName = (label: string) => `test-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  it("GET /api/marketplace lists published registry plugins", async () => {
    const { status, body, contentType } = await request("GET", "/api/marketplace");
    assert.strictEqual(status, 200);
    assert.match(contentType, /application\/json/);
    assert.ok(Array.isArray(body.plugins), "plugins array present");
    assert.ok(body.plugins.length > 0, "registry seeded with published plugins");
    assert.strictEqual(typeof body.published, "number");
    assert.strictEqual(typeof body.installedCount, "number");
    assert.ok(Array.isArray(body.categories));
    const sample = body.plugins[0];
    for (const key of ["id", "name", "version", "description", "category", "installed", "downloads"]) {
      assert.ok(key in sample, `plugin exposes ${key}`);
    }
  });

  it("GET /api/marketplace preserves legacy store-backed fields", async () => {
    const { body } = await request("GET", "/api/marketplace");
    assert.ok(Array.isArray(body.packages), "legacy packages preserved");
    assert.ok(Array.isArray(body.approvals), "legacy approvals preserved");
    assert.ok(body.analytics && typeof body.analytics === "object", "legacy analytics preserved");
  });

  it("GET /api/marketplace?q= filters the catalog", async () => {
    const name = uniqueName("searchable");
    const published = await request("POST", "/api/marketplace", {
      name,
      version: "1.0.0",
      description: "uniquely findable marketplace fixture",
      category: "plugin",
    });
    assert.strictEqual(published.status, 201);

    const hit = await request("GET", `/api/marketplace?q=${encodeURIComponent(name)}`);
    assert.strictEqual(hit.status, 200);
    assert.strictEqual(hit.body.plugins.length, 1);
    assert.strictEqual(hit.body.plugins[0].name, name);

    const miss = await request("GET", "/api/marketplace?q=zzz-no-such-plugin-zzz");
    assert.strictEqual(miss.body.plugins.length, 0);
    assert.strictEqual(miss.body.total, 0);
  });

  it("GET /api/marketplace?category= and ?installed= filter the catalog", async () => {
    const byCategory = await request("GET", "/api/marketplace?category=theme");
    assert.strictEqual(byCategory.status, 200);
    assert.ok(byCategory.body.plugins.every((p: any) => p.category === "theme"));

    const notInstalled = await request("GET", "/api/marketplace?installed=false");
    assert.ok(notInstalled.body.plugins.every((p: any) => p.installed === false));

    const installed = await request("GET", "/api/marketplace?installed=true");
    assert.ok(installed.body.plugins.every((p: any) => p.installed === true));
  });

  it("POST /api/marketplace publishes a plugin into the registry", async () => {
    const name = uniqueName("publish");
    const { status, body } = await request("POST", "/api/marketplace", {
      name,
      version: "2.1.3",
      description: "published by contract test",
      author: "test-suite",
      category: "tool",
      tags: ["test", "fixture"],
      source: "registry://test/publish",
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(body.published, true);
    assert.strictEqual(body.plugin.name, name);
    assert.strictEqual(body.plugin.version, "2.1.3");
    assert.strictEqual(body.plugin.installed, false);
    assert.strictEqual(body.plugin.downloads, 0);
    assert.deepStrictEqual(body.plugin.tags, ["test", "fixture"]);
    assert.ok(body.plugin.id.includes(name), "id derived from name+version");
    assert.ok(body.plugin.published_at, "published_at stamped");

    const listed = await request("GET", `/api/marketplace?q=${encodeURIComponent(name)}`);
    assert.strictEqual(listed.body.plugins.length, 1);
    assert.strictEqual(listed.body.plugins[0].id, body.plugin.id);
  });

  it("POST /api/marketplace rejects missing fields and bad semver", async () => {
    const missing = await request("POST", "/api/marketplace", { name: "no-version" });
    assert.strictEqual(missing.status, 400);
    assert.match(String(missing.body.error), /version/);

    const badVersion = await request("POST", "/api/marketplace", { name: uniqueName("semver"), version: "not-semver" });
    assert.strictEqual(badVersion.status, 400);
    assert.match(String(badVersion.body.error), /semver/);
  });

  it("POST /api/marketplace rejects a duplicate name@version with 409", async () => {
    const name = uniqueName("dupe");
    const first = await request("POST", "/api/marketplace", { name, version: "1.0.0" });
    assert.strictEqual(first.status, 201);
    const second = await request("POST", "/api/marketplace", { name, version: "1.0.0" });
    assert.strictEqual(second.status, 409);
    assert.strictEqual(second.body.published, false);
    assert.match(String(second.body.error), /already published/);
  });

  it("POST /api/marketplace/:id/install marks the plugin installed", async () => {
    const name = uniqueName("install");
    const published = await request("POST", "/api/marketplace", { name, version: "0.4.2", category: "plugin" });
    assert.strictEqual(published.status, 201);
    const id = published.body.plugin.id;
    assert.strictEqual(published.body.plugin.installed, false);

    const installed = await request("POST", `/api/marketplace/${encodeURIComponent(id)}/install`, {});
    assert.strictEqual(installed.status, 200);
    assert.strictEqual(installed.body.installed, true);
    assert.strictEqual(installed.body.already, false);
    assert.strictEqual(installed.body.plugin.installed, true);
    assert.strictEqual(installed.body.plugin.downloads, 1);
    assert.ok(installed.body.plugin.installed_at, "installed_at stamped");

    const listed = await request("GET", `/api/marketplace?q=${encodeURIComponent(name)}`);
    assert.strictEqual(listed.body.plugins[0].installed, true);
  });

  it("POST /api/marketplace/:id/install is idempotent", async () => {
    const name = uniqueName("idempotent");
    const published = await request("POST", "/api/marketplace", { name, version: "1.2.0" });
    const id = published.body.plugin.id;

    const first = await request("POST", `/api/marketplace/${encodeURIComponent(id)}/install`, {});
    assert.strictEqual(first.body.already, false);
    const second = await request("POST", `/api/marketplace/${encodeURIComponent(id)}/install`, {});
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.already, true);
    assert.strictEqual(second.body.plugin.downloads, first.body.plugin.downloads, "downloads not double counted");
  });

  it("POST /api/marketplace/:id/install accepts a plugin name as the id", async () => {
    const name = uniqueName("by-name");
    await request("POST", "/api/marketplace", { name, version: "3.0.0" });
    const { status, body } = await request("POST", `/api/marketplace/${encodeURIComponent(name)}/install`, {});
    assert.strictEqual(status, 200);
    assert.strictEqual(body.plugin.name, name);
    assert.strictEqual(body.plugin.installed, true);
  });

  it("POST /api/marketplace/:id/install returns 404 for an unknown plugin", async () => {
    const { status, body } = await request("POST", "/api/marketplace/no-such-plugin-xyz/install", {});
    assert.strictEqual(status, 404);
    assert.match(String(body.error), /not found/);
  });

  it("does not shadow the legacy POST /api/marketplace/install route", async () => {
    const { status, body } = await request("POST", "/api/marketplace/install", { name: "forgeos-core" });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.installed, "forgeos-core");
  });

  it("persists the registry to data/registry.json", async () => {
    const name = uniqueName("persisted");
    await request("POST", "/api/marketplace", { name, version: "1.0.1" });
    assert.ok(fs.existsSync(REGISTRY_FILE), "registry.json written under data/");
    const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8")) as { plugins: Array<{ name: string }> };
    assert.ok(Array.isArray(raw.plugins));
    assert.ok(raw.plugins.some((p) => p.name === name), "published plugin durable on disk");
  });
});
