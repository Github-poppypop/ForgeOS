import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { publish, discover, listAll } from "../src/index";

describe("marketplace smoke", () => {
  it("publishes and discovers a package", async () => {
    const pub = await publish({
      name: "smoke-pkg",
      version: "0.1.0",
      source: "local",
      description: "smoke",
    });
    assert.strictEqual(pub.ok, true);
    assert.strictEqual(pub.package.name, "smoke-pkg");

    const found = await discover({ q: "smoke", source: "local" });
    assert.strictEqual(found.ok, true);
    assert.ok(found.packages.some((p) => p.name === "smoke-pkg"));

    const all = listAll();
    assert.ok(all.some((p) => p.name === "smoke-pkg"));
  });
});
