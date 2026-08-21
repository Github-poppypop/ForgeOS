import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildKnowledgeGraph } from "../knowledgeGraph";

describe("knowledgeGraph", () => {
  it("derives a graph from the knowledge-universe .data (auto-resolved)", () => {
    const g = buildKnowledgeGraph();
    assert.equal(g.ok, true);
    assert.equal(typeof g.source, "string");
    assert.ok(Array.isArray(g.nodes));
    assert.ok(Array.isArray(g.edges));
    assert.ok(g.stats.pages >= 1, "expected at least one page node");
    assert.ok(g.stats.edges >= 1, "expected at least one edge");
  });

  it("builds nodes and edges from real audit/acl/analytics files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forgeos-kg-"));
    try {
      fs.writeFileSync(
        path.join(dir, "audit.jsonl"),
        [
          JSON.stringify({ slug: "p1", action: "update", user: "alice" }),
          JSON.stringify({ slug: "p1", action: "create", user: "bob" }),
        ].join("\n"),
      );
      fs.writeFileSync(
        path.join(dir, "acls.json"),
        JSON.stringify({ p1: { admin: true } }),
      );
      fs.writeFileSync(
        path.join(dir, "analytics.json"),
        JSON.stringify({ p1: 7 }),
      );

      const g = buildKnowledgeGraph(dir);
      assert.equal(g.ok, true);
      assert.equal(g.stats.pages, 1);
      assert.equal(g.stats.users, 2);
      assert.equal(g.stats.roles, 1);
      assert.equal(g.stats.edges, 3); // 2 mutation + 1 access

      const pageNode = g.nodes.find((n) => n.id === "page:p1");
      assert.ok(pageNode, "page:p1 node present");
      assert.equal((pageNode!.meta as { views: number }).views, 7);

      const accessEdge = g.edges.find((e) => e.kind === "access");
      assert.ok(accessEdge, "access edge present");
      assert.equal(accessEdge!.label, "acl");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to a seed graph when no data is present", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forgeos-kg-empty-"));
    try {
      const g = buildKnowledgeGraph(dir);
      assert.equal(g.ok, true);
      assert.ok(
        g.stats.pages >= 1 && g.stats.users >= 1,
        "seed graph has nodes",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
