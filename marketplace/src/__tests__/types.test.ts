import { describe, it, expect } from "bun:test";
import { MarketplacePackage, PublishRequest, DiscoverQuery } from "../types";
describe("marketplace/types", () => {
  it("accepts package shape", () => {
    const pkg: MarketplacePackage = {
      name: "x",
      version: "1.0.0",
      source: "local",
      tags: ["a"],
    };
    expect(pkg.name).toBe("x");
  });
  it("accepts publish/query shapes", () => {
    const req: PublishRequest = { name: "y", version: "0.1.0", source: "builtin" };
    const q: DiscoverQuery = { tag: "ui", limit: 10 };
    expect(req.name).toBe("y");
    expect(q.limit).toBe(10);
  });
});
