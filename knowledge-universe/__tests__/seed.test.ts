import { describe, it, expect } from "bun:test";
import { ingestFile } from "../knowledge-universe/seed.ts";
describe("knowledge-universe/seed", () => {
  it("ingests missing file as skip", async () => {
    const r = await ingestFile(process.cwd(), { slug: "vision", file: "___missing___.md", type: "vision", bytes: 0 });
    expect(r.status).toBe("skip");
    expect(r.detail).toContain("not found");
  });
});
