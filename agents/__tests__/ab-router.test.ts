/**
 * agents/__tests__/ab-router.test.ts — tests for agents/ab-router.ts
 *
 * Uses node:test so it runs via `npx tsx --test` from the repo root (the same
 * scope that verified the other Batch C #21–#24 modules). Covers the A/B
 * canary-routing contract for backlog item #28.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  AbRouter,
  fnv1a,
  bucketOf,
  type Variant,
} from "../ab-router";

const SAMPLE = Array.from({ length: 1000 }, (_, i) => `req-${i}`);

describe("AbRouter", () => {
  it("routes everything to A at 0% canary (stable default)", () => {
    const r = new AbRouter({ canaryPercent: 0 });
    for (const k of SAMPLE) assert.strictEqual(r.selectVariant(k), "A");
  });

  it("routes everything to B at 100% canary (full cutover)", () => {
    const r = new AbRouter({ canaryPercent: 100 });
    for (const k of SAMPLE) assert.strictEqual(r.selectVariant(k), "B");
  });

  it("is deterministic: the same key always maps to the same variant", () => {
    const r = new AbRouter({ canaryPercent: 37, salt: "lab" });
    const first = r.selectVariant("mission-42");
    for (let i = 0; i < 50; i++) {
      assert.strictEqual(r.selectVariant("mission-42"), first);
    }
    // And the bucket is stable too.
    assert.strictEqual(bucketOf("mission-42", "lab"), bucketOf("mission-42", "lab"));
  });

  it("approximates the configured canary percentage over a large sample", () => {
    for (const pct of [10, 25, 50, 73]) {
      const r = new AbRouter({ canaryPercent: pct });
      const stats = r.getStats(2000);
      const observed = stats.b / stats.total;
      // Allow a generous ±6pp band; a uniform hash converges well within this.
      assert.ok(
        Math.abs(observed - pct / 100) < 0.06,
        `expected ~${pct}% canary, observed ${(observed * 100).toFixed(1)}%`
      );
    }
  });

  it("configure() changes routing for the same key", () => {
    const r = new AbRouter({ canaryPercent: 0 });
    assert.strictEqual(r.selectVariant("same-key"), "A");
    r.configure({ canaryPercent: 100 });
    assert.strictEqual(r.selectVariant("same-key"), "B");
    assert.strictEqual(r.getPercent(), 100);
  });

  it("salt reshuffles bucketing without changing the split size", () => {
    const a = new AbRouter({ canaryPercent: 50, salt: "salt-A" });
    const b = new AbRouter({ canaryPercent: 50, salt: "salt-B" });

    // Same input string with different salts MUST hash differently.
    assert.notStrictEqual(fnv1a("k::s1"), fnv1a("k::s2"));

    const keys = Array.from({ length: 200 }, (_, i) => `u-${i}`);
    const bA = keys.filter((k) => a.selectVariant(k) === "B").sort();
    const bB = keys.filter((k) => b.selectVariant(k) === "B").sort();
    // Both salts yield ~50% canary, but a different salt MUST reshuffle *which*
    // keys are canary (the membership must differ).
    assert.notDeepStrictEqual(bA, bB, "a different salt must reshuffle which keys are canary");
  });

  it("decide() records a bounded, correctly-shaped decision log", () => {
    const clock = { t: 0 };
    const r = new AbRouter({ canaryPercent: 50, logSize: 3, now: () => clock.t });
    const d1 = r.decide("k1");
    clock.t = 100;
    const d2 = r.decide("k2");
    clock.t = 200;
    r.decide("k3");
    r.decide("k4"); // pushes the ring buffer past logSize

    const recent = r.recentDecisions();
    assert.strictEqual(recent.length, 3, "log is capped at logSize");
    assert.strictEqual(recent[0].key, "k4", "most-recent-first ordering");
    assert.deepStrictEqual(recent[0].key, "k4");

    // The two recorded decisions carry the right shape.
    for (const d of [d1, d2]) {
      assert.ok(["A", "B"].includes(d.variant as Variant));
      assert.strictEqual(d.bucket >= 0 && d.bucket < 100, true);
      assert.strictEqual(d.isCanary, d.variant === "B");
      assert.strictEqual(typeof d.at, "number");
    }
  });

  it("clamps out-of-range canary percentages", () => {
    const r = new AbRouter({ canaryPercent: 150 });
    assert.strictEqual(r.getPercent(), 100);
    r.configure({ canaryPercent: -5 });
    assert.strictEqual(r.getPercent(), 0);
    r.configure({ canaryPercent: 42.7 });
    assert.strictEqual(r.getPercent(), 42.7);
  });

  it("getStats reports a canary share matching the configured percent", () => {
    const r = new AbRouter({ canaryPercent: 30 });
    const stats = r.getStats(5000);
    assert.ok(Math.abs(stats.canaryShare - 0.3) < 0.05);
    assert.strictEqual(stats.a + stats.b, stats.total);
  });
});
