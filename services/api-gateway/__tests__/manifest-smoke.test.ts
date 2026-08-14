import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

describe("services/api-gateway smoke", () => {
  it("has manifest and route catalog", () => {
    const root = process.cwd();
    assert.ok(existsSync(`${root}/manifest.json`), "manifest.json missing");
    const readme = readFileSync(`${root}/README.md`, "utf8");
    assert.ok(readme.includes("/healthz"));
    assert.ok(readme.includes("/api/status"));
    assert.ok(readme.includes("Bearer"));
  });
});
