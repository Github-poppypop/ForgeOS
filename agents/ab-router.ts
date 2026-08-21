/**
 * agents/ab-router.ts — Deterministic A/B (canary) routing for agent prompts.
 *
 * Backlog item #28 ("Agent A/B routing for canary prompts").
 *
 * Pairs with the Batch C hardening family (retry.ts #21, circuit-breaker.ts #22,
 * guardrails.ts #23, schema-validator.ts #24): it lets an operator safely ship a
 * *candidate* prompt/model variant ("B", the canary) to only a configurable
 * percentage of traffic while the *stable* variant ("A") keeps serving the rest.
 * Bucketing is **deterministic per request key** (a prompt id, user id, mission
 * id, …) via a stable FNV-1a hash, so the same key always lands in the same
 * variant — no flicker mid-session, and canaries are reproducible.
 *
 * Design notes:
 * - Dependency-free, framework-agnostic. The only injected seam is `now()`
 *   (a monotonic ms clock) so the decision log can be driven in tests.
 * - `canaryPercent` is clamped to [0, 100]. 0 ⇒ everything is "A" (stable);
 *   100 ⇒ everything is "B" (full cutover). Default 0 (no canary) so a freshly
 *   constructed router is a no-op and safe to drop into a dispatch path.
 * - `selectVariant(key)` is pure: identical (key, salt, percent) ⇒ identical
 *   variant. This is what makes canary experiments sound.
 * - `decide(key)` is the logging variant of `selectVariant`: it records the
 *   choice to a bounded in-memory ring buffer for operator visibility.
 * - `getStats()` lets a UI estimate the live split over a synthetic sample
 *   without touching production traffic.
 *
 * This module is the canonical implementation. The brain-console feature panel
 * (`apps/brain-console/src/client/src/features/feat-abrouting.tsx`) mirrors the
 * same algorithm client-side for offline/mock-first visualization; the runtime
 * dispatch wiring (applying `selectVariant` inside the agent spawn path) is the
 * backend follow-up.
 */

export type Variant = "A" | "B";

export interface AbRouterOptions {
  /** Percent of traffic (0–100) routed to the canary variant "B". Default 0. */
  canaryPercent?: number;
  /** Salt mixed into the hash so different deployments bucket differently. */
  salt?: string;
  /** Monotonic clock in ms (injectable for tests). Defaults to Date.now. */
  now?: () => number;
  /** Max entries retained in the decision log. Default 50. */
  logSize?: number;
}

export interface Decision {
  key: string;
  variant: Variant;
  /** Hash bucket in [0, 100). */
  bucket: number;
  /** Active canary percentage at decision time. */
  percent: number;
  /** True when the canary ("B") was chosen. */
  isCanary: boolean;
  /** Epoch ms of the decision. */
  at: number;
}

export interface RoutingStats {
  total: number;
  a: number;
  b: number;
  /** Observed canary share in [0, 1]. */
  canaryShare: number;
}

/** FNV-1a 32-bit hash → returns a number in [0, 2^32). */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (FNV prime) with 32-bit overflow
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic bucket in [0, 100) for a request key under a salt.
 * Same (key, salt) ⇒ same bucket, always.
 */
export function bucketOf(key: string, salt = ""): number {
  const mixed = salt ? `${salt}::${key}` : key;
  return fnv1a(mixed) % 100;
}

export class AbRouter {
  private canaryPercent: number;
  private salt: string;
  private readonly now: () => number;
  private readonly logSize: number;
  private readonly log: Decision[] = [];

  constructor(options: AbRouterOptions = {}) {
    this.canaryPercent = AbRouter.clamp(options.canaryPercent ?? 0);
    this.salt = options.salt ?? "";
    this.now = options.now ?? Date.now;
    this.logSize = Math.max(1, options.logSize ?? 50);
  }

  private static clamp(p: number): number {
    if (!Number.isFinite(p)) return 0;
    return Math.min(100, Math.max(0, p));
  }

  /** Current canary percentage (0–100). */
  getPercent(): number {
    return this.canaryPercent;
  }

  /** Current salt (empty string when unset). */
  getSalt(): string {
    return this.salt;
  }

  /**
   * Update configuration. Unsupplied fields are left unchanged. Percent is
   * clamped to [0, 100].
   */
  configure(options: AbRouterOptions): void {
    if (options.canaryPercent !== undefined) {
      this.canaryPercent = AbRouter.clamp(options.canaryPercent);
    }
    if (options.salt !== undefined) {
      this.salt = options.salt;
    }
  }

  /** Pure variant selection for a request key. Deterministic. */
  selectVariant(key: string): Variant {
    const bucket = bucketOf(key, this.salt);
    return bucket < this.canaryPercent ? "B" : "A";
  }

  /**
   * Logging variant of `selectVariant`. Records the decision to a bounded ring
   * buffer and returns the full decision detail.
   */
  decide(key: string): Decision {
    const bucket = bucketOf(key, this.salt);
    const variant: Variant = bucket < this.canaryPercent ? "B" : "A";
    const decision: Decision = {
      key,
      variant,
      bucket,
      percent: this.canaryPercent,
      isCanary: variant === "B",
      at: this.now(),
    };
    this.log.push(decision);
    if (this.log.length > this.logSize) {
      this.log.splice(0, this.log.length - this.logSize);
    }
    return decision;
  }

  /** Most-recent-first copy of the decision log (capped at `limit`). */
  recentDecisions(limit?: number): Decision[] {
    const slice = this.log.slice();
    slice.reverse();
    return limit === undefined ? slice : slice.slice(0, limit);
  }

  /**
   * Estimate the live A/B split over a sample. With no `keys` provided, uses
   * `sampleSize` synthetic keys (`sample-0` … `sample-N`) so a UI can preview
   * the distribution without touching production traffic.
   */
  getStats(sampleSize = 1000, keys?: string[]): RoutingStats {
    const sample =
      keys && keys.length > 0
        ? keys
        : Array.from({ length: sampleSize }, (_, i) => `sample-${i}`);
    let b = 0;
    for (const k of sample) {
      if (this.selectVariant(k) === "B") b++;
    }
    const total = sample.length;
    return {
      total,
      a: total - b,
      b,
      canaryShare: total > 0 ? b / total : 0,
    };
  }
}
