import { describe, it, expect } from "bun:test";
import { spawnAgent, terminateAgent, tailLog, loadProfile, listProfiles } from "../spawn";
describe("agents/spawn", () => {
  it("loads a known profile", async () => {
    const profile = loadProfile("ceo");
    expect(profile.id).toBe("ceo");
    expect(profile.role.toLowerCase()).toContain("chief executive");
  });
  it("lists all c-suite profiles", async () => {
    const profiles = listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(7);
  });
  it("terminateAgent returns boolean", async () => {
    expect(typeof terminateAgent(99999, 10)).toBe("object");
  });
  it("tailLog returns array for missing log", async () => {
    expect(Array.isArray(tailLog("does-not-exist"))).toBe(true);
  });
});
