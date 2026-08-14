import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { loadProfile, listProfiles, spawnAgent } from "../spawn";

describe("agents/spawn smoke", () => {
  it("loads cto profile", () => {
    const profile = loadProfile("cto");
    assert.ok(profile);
    assert.strictEqual(profile.id, "cto");
  });

  it("lists c-suite profiles", () => {
    const profiles = listProfiles();
    assert.ok(Array.isArray(profiles));
    assert.ok(profiles.length >= 5);
  });

  it("spawns an agent and reports lifecycle", async () => {
    const events: string[] = [];
    const result = await spawnAgent("cto", {
      brief: "smoke test",
      timeoutSec: 10,
      runtimeRoot: "./tmp-agents-smoke",
      onEvent: (ev) => events.push(ev.type),
    });
    assert.ok(result.logPath || result.ok || result.exitCode === 0);
    assert.ok(events.includes("spawn"));
  });
});
