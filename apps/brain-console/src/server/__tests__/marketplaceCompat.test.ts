import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HOST_CAPABILITIES,
  checkCompatibility,
  compareSemver,
  hostEnvironment,
  parseSemver,
  satisfiesRange,
} from "../marketplaceCompat";

// Unit coverage for the marketplace capability compatibility checker (#42).
// Pure functions -- no Express boot required.

describe("marketplaceCompat semver helpers", () => {
  it("parses plain, v-prefixed and pre-release versions", () => {
    assert.deepEqual(parseSemver("1.2.3"), { major: 1, minor: 2, patch: 3 });
    assert.deepEqual(parseSemver("v0.9.1"), { major: 0, minor: 9, patch: 1 });
    assert.deepEqual(parseSemver("2.0.0-beta.4"), { major: 2, minor: 0, patch: 0 });
  });

  it("rejects non-semver input", () => {
    assert.equal(parseSemver("1.2"), null);
    assert.equal(parseSemver("banana"), null);
    assert.equal(parseSemver(undefined), null);
  });

  it("orders versions", () => {
    const a = parseSemver("1.0.0")!;
    const b = parseSemver("1.0.1")!;
    const c = parseSemver("2.0.0")!;
    assert.equal(compareSemver(a, b), -1);
    assert.equal(compareSemver(b, a), 1);
    assert.equal(compareSemver(a, a), 0);
    assert.equal(compareSemver(c, b), 1);
  });

  it("treats an empty range as satisfied by anything (permissive default)", () => {
    assert.equal(satisfiesRange("1.0.0", ""), true);
    assert.equal(satisfiesRange("1.0.0", undefined), true);
    assert.equal(satisfiesRange("1.0.0", "*"), true);
  });

  it("evaluates comparator ranges", () => {
    assert.equal(satisfiesRange("1.0.0", ">=1.0.0"), true);
    assert.equal(satisfiesRange("0.9.9", ">=1.0.0"), false);
    assert.equal(satisfiesRange("1.5.0", ">1.0.0"), true);
    assert.equal(satisfiesRange("1.0.0", "<2.0.0"), true);
    assert.equal(satisfiesRange("2.0.0", "<=2.0.0"), true);
    assert.equal(satisfiesRange("1.2.3", "1.2.3"), true);
    assert.equal(satisfiesRange("1.2.4", "1.2.3"), false);
  });

  it("evaluates caret ranges including the 0.x special case", () => {
    assert.equal(satisfiesRange("1.4.0", "^1.0.0"), true);
    assert.equal(satisfiesRange("2.0.0", "^1.0.0"), false);
    assert.equal(satisfiesRange("0.9.5", "^0.9.1"), true);
    assert.equal(satisfiesRange("0.10.0", "^0.9.1"), false);
  });

  it("evaluates tilde ranges", () => {
    assert.equal(satisfiesRange("1.2.9", "~1.2.3"), true);
    assert.equal(satisfiesRange("1.3.0", "~1.2.3"), false);
  });

  it("evaluates AND and OR groups", () => {
    assert.equal(satisfiesRange("1.5.0", ">=1.0.0 <2.0.0"), true);
    assert.equal(satisfiesRange("2.1.0", ">=1.0.0 <2.0.0"), false);
    assert.equal(satisfiesRange("3.0.0", "^1.0.0 || ^3.0.0"), true);
  });

  it("fails a declared range when the version is unparseable", () => {
    assert.equal(satisfiesRange("not-a-version", ">=1.0.0"), false);
  });
});

describe("marketplaceCompat checkCompatibility", () => {
  const host = hostEnvironment({ engine: "1.0.0", node: "22.0.0", installed: ["theme-obsidian"] });

  it("is permissive for a plugin that declares nothing (legacy registry entries)", () => {
    const report = checkCompatibility({ name: "embed-worker", version: "0.3.0" }, host);
    assert.equal(report.compatible, true);
    assert.equal(report.message, "Compatible");
    assert.deepEqual(report.missingCapabilities, []);
    assert.deepEqual(report.conflicts, []);
  });

  it("rejects a missing name and a non-semver version", () => {
    const report = checkCompatibility({ name: "", version: "1.2" }, host);
    assert.equal(report.compatible, false);
    const failed = report.checks.filter((c) => !c.ok).map((c) => c.id);
    assert.ok(failed.includes("name"));
    assert.ok(failed.includes("version"));
    assert.match(report.message, /^Incompatible/);
  });

  it("blocks when the host engine is below the declared range", () => {
    const report = checkCompatibility(
      { name: "future-plugin", version: "1.0.0", engines: { forgeos: ">=2.0.0" } },
      host,
    );
    assert.equal(report.compatible, false);
    assert.equal(report.checks.find((c) => c.id === "engine")?.ok, false);
  });

  it("accepts an engine range the host satisfies, including a bare range string", () => {
    assert.equal(checkCompatibility({ name: "p", version: "1.0.0", engines: "^1.0.0" }, host).compatible, true);
    assert.equal(checkCompatibility({ name: "p", version: "1.0.0", minEngine: ">=1.0.0" }, host).compatible, true);
  });

  it("blocks on a node range the host does not satisfy", () => {
    const report = checkCompatibility({ name: "p", version: "1.0.0", engines: { node: ">=99.0.0" } }, host);
    assert.equal(report.compatible, false);
    assert.equal(report.checks.find((c) => c.id === "node")?.ok, false);
  });

  it("reports missing host capabilities and blocks the install", () => {
    const report = checkCompatibility(
      { name: "gpu-plugin", version: "1.0.0", requires: ["console:panels", "gpu:cuda", "kernel:module"] },
      host,
    );
    assert.equal(report.compatible, false);
    assert.deepEqual(report.missingCapabilities, ["gpu:cuda", "kernel:module"]);
  });

  it("passes when every required capability is provided by the host", () => {
    const report = checkCompatibility(
      { name: "panel-plugin", version: "1.0.0", requires: ["console:panels", "storage:local"] },
      host,
    );
    assert.equal(report.compatible, true);
    assert.deepEqual(report.missingCapabilities, []);
  });

  it("accepts a comma-separated requires string", () => {
    const report = checkCompatibility({ name: "p", version: "1.0.0", requires: "console:panels, sse:stream" }, host);
    assert.equal(report.compatible, true);
  });

  it("detects a conflict with an installed plugin only when it is installed", () => {
    const conflicting = checkCompatibility(
      { name: "theme-solar", version: "1.0.0", conflicts: ["theme-obsidian"] },
      host,
    );
    assert.equal(conflicting.compatible, false);
    assert.deepEqual(conflicting.conflicts, ["theme-obsidian"]);

    const fine = checkCompatibility({ name: "theme-solar", version: "1.0.0", conflicts: ["theme-nope"] }, host);
    assert.equal(fine.compatible, true);
  });

  it("treats unrecognised provided capabilities as a warning, not a blocker", () => {
    const report = checkCompatibility({ name: "p", version: "1.0.0", capabilities: ["weird:thing"] }, host);
    assert.equal(report.compatible, true);
    assert.equal(report.checks.find((c) => c.id === "provides")?.ok, false);
    assert.equal(report.checks.find((c) => c.id === "provides")?.severity, "warn");
  });

  it("exposes the host descriptor and a stable check set", () => {
    const report = checkCompatibility({ name: "p", version: "1.0.0" }, host);
    assert.deepEqual(
      report.checks.map((c) => c.id),
      ["name", "version", "engine", "node", "capabilities", "conflicts", "provides"],
    );
    assert.equal(report.host.engine, "1.0.0");
    assert.ok(report.host.capabilities.includes("console:panels"));
  });

  it("defaults the host to the real runtime capability set", () => {
    const env = hostEnvironment();
    assert.equal(env.capabilities.length, HOST_CAPABILITIES.length);
    assert.ok(parseSemver(env.node) !== null);
  });
});
