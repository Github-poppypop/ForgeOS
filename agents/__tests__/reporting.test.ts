import { describe, it, expect } from "bun:test";
import { compileReport, buildOwnerChain, reports, latestForAgent, latestForCEO } from "../agents/reporting.ts";
describe("agents/reporting", () => {
  it("builds owner chain from cto to board", async () => {
    const chain = buildOwnerChain("cto");
    expect(chain).toEqual(["CTO", "CEO", "Board"]);
  });
  it("compiles and retrieves a report", async () => {
    const r = compileReport({ agentId: "cto", summary: "ok", status: "green" });
    expect(r.status).toBe("green");
    expect(reports.get(r.id)).toBeDefined();
    expect(latestForAgent("cto")?.id).toBe(r.id);
  });
  it("latestForCEO is undefined until CEO report created", async () => {
    expect(latestForCEO()).toBeUndefined();
  });
});
