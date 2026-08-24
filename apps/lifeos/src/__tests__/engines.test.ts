/**
 * src/__tests__/engines.test.ts — Real tests for the LifeOS cognitive engine
 * (engines.ts): ingest/retrieve over the Knowledge Universe, mission reconcile
 * against DNA hard constraints, goal decompose, and mandate plan.
 *
 * Pure transforms — no gbrain/network needed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ingest,
  retrieve,
  reconcile,
  decompose,
  plan,
  type BrainDNA,
  type Mission,
  type Goal,
  type MemoryRecord,
} from "../engines.js";

const dna: BrainDNA = {
  id: "dna1",
  version: 1,
  traits: [],
  values: [],
  preferences: [],
  constraints: [{ id: "c1", rule: "no self-harm", severity: "hard" }, { id: "c2", rule: "be kind", severity: "soft" }],
  updatedAt: "2026-01-01T00:00:00Z",
};

const mission: Mission = { id: "m1", statement: "live well", principles: [], horizon: "life" };

test("ingest appends a record with an id and timestamp", () => {
  const ku: MemoryRecord[] = [];
  const out = ingest(ku, { kind: "semantic", content: "hello", source: "test" });
  assert.equal(out.length, 1);
  assert.ok(out[0].id.startsWith("mem_"), "id generated");
  assert.ok(out[0].timestamp, "timestamp set");
  assert.equal(out[0].content, "hello");
  assert.equal(ku.length, 0, "input array not mutated");
});

test("retrieve filters by substring (case-insensitive) and sorts by recency", () => {
  const ku: MemoryRecord[] = [
    { id: "a", kind: "episodic", content: "Old memory about DOGS", source: "s", timestamp: "2026-01-01T00:00:00Z" },
    { id: "b", kind: "semantic", content: "New note on cats", source: "s", timestamp: "2026-03-01T00:00:00Z" },
    { id: "c", kind: "procedural", content: "unrelated", source: "s", timestamp: "2026-02-01T00:00:00Z" },
  ];
  const res = retrieve(ku, "dog");
  assert.equal(res.length, 1);
  assert.equal(res[0].id, "a");
  const res2 = retrieve(ku, "CAT");
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, "b");
  // recency sort: newest first
  const all = retrieve(ku, "");
  assert.equal(all[0].id, "b", "newest first on empty query");
});

test("reconcile blocks a proposal that breaches a hard DNA constraint", () => {
  const res = reconcile(mission, dna, { statement: "our operating rule is no self-harm" } as Partial<Mission>);
  assert.equal(res.ok, false);
  if (!res.ok) assert.ok(res.conflict.includes("self-harm"), "names the breached rule");
});

test("reconcile merges a safe proposal", () => {
  const res = reconcile(mission, dna, { statement: "live kindly" } as Partial<Mission>);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.mission.statement, "live kindly");
    assert.equal(res.mission.id, "m1", "identity preserved");
  }
});

test("decompose returns a single sub-goal linked to the parent", () => {
  const goal: Goal = { id: "g1", title: "Write the book", status: "active", subGoals: [], agentRefs: [] };
  const subs = decompose(goal, mission, dna);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].parentGoalId, "g1");
  assert.ok(subs[0].title.includes("Write the book"));
});

test("plan returns in-mandate steps referencing the goal and memory count", () => {
  const goal: Goal = { id: "g1", title: "Ship it", status: "active", subGoals: [], agentRefs: [] };
  const ku: MemoryRecord[] = [
    { id: "a", kind: "semantic", content: "x", source: "s", timestamp: "2026-01-01T00:00:00Z" },
    { id: "b", kind: "semantic", content: "y", source: "s", timestamp: "2026-01-01T00:00:00Z" },
  ];
  const steps = plan({ allowedActions: [], forbiddenActions: [], dnaRef: "dna1" }, goal, ku);
  assert.equal(steps.length, 2);
  assert.ok(steps[0].includes("Ship it"));
  assert.ok(steps[1].includes("2 memories"));
});
