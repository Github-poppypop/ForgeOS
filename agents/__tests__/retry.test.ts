/**
 * agents/__tests__/retry.test.ts — tests for agents/retry.ts
 *
 * Uses node:test so it runs locally via `npx tsx --test` and is also accepted
 * by Bun (which implements node:test). Covers the retry/backoff contract for
 * backlog item #21.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  withRetry,
  isRetryable,
  NonRetryableError,
  sleep,
  type RetryOptions,
} from "../retry";

// Fast retry config for all tests (no real waiting).
const FAST: RetryOptions = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, factor: 1, jitter: false };

describe("agents/retry withRetry", () => {
  it("returns the value on first-attempt success without retrying", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return "ok";
    }, FAST);
    assert.strictEqual(result, "ok");
    assert.strictEqual(calls, 1);
  });

  it("passes the 1-based attempt index to fn", async () => {
    let seen: number[] = [];
    await withRetry(
      async (attempt) => {
        seen.push(attempt);
        if (attempt < 2) throw new Error("retry me");
        return seen.length;
      },
      FAST
    );
    assert.deepStrictEqual(seen, [1, 2]);
  });

  it("retries on throw and resolves once fn succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error(`fail ${calls}`);
        return `ok after ${calls}`;
      },
      FAST
    );
    assert.strictEqual(result, "ok after 3");
    assert.strictEqual(calls, 3);
  });

  it("throws the last error after maxAttempts are exhausted", async () => {
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw new Error(`always ${calls}`);
          },
          FAST
        ),
      /always 3/
    );
    assert.strictEqual(calls, 3);
  });

  it("bails immediately when shouldRetry returns false (no extra attempts)", async () => {
    let calls = 0;
    const err = new Error("fatal");
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw err;
          },
          { ...FAST, shouldRetry: () => false }
        ),
      /fatal/
    );
    assert.strictEqual(calls, 1);
  });

  it("does not retry NonRetryableError", async () => {
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw new NonRetryableError("stop");
          },
          FAST
        ),
      /stop/
    );
    assert.strictEqual(calls, 1);
  });

  it("isRetryable treats NonRetryableError and AbortError as non-retryable", () => {
    assert.strictEqual(isRetryable(new NonRetryableError("x")), false);
    const ab = new Error("a");
    ab.name = "AbortError";
    assert.strictEqual(isRetryable(ab), false);
    assert.strictEqual(isRetryable(new Error("transient")), true);
  });

  it("invokes onAttempt for each retried failure", async () => {
    const attempts: number[] = [];
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            throw new Error("boom");
          },
          { ...FAST, onAttempt: (a) => attempts.push(a) }
        ),
      /boom/
    );
    // attempt 1 and 2 are retried (3rd is terminal, not "retried")
    assert.deepStrictEqual(attempts, [1, 2]);
  });

  it("respects AbortSignal and does not run when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw new Error("nope");
          },
          { ...FAST, signal: controller.signal }
        ),
      /AbortError/
    );
    // Already-aborted signal short-circuits before the first attempt.
    assert.strictEqual(calls, 0);
  });

  it("stops retrying once the signal aborts between attempts", async () => {
    const controller = new AbortController();
    let calls = 0;
    const p = withRetry(
      async () => {
        calls++;
        throw new Error("transient");
      },
      {
        maxAttempts: 5,
        baseDelayMs: 50,
        maxDelayMs: 100,
        factor: 1,
        jitter: false,
        signal: controller.signal,
      }
    );
    // Abort during the first backoff (attempt 1 has already run) so only 1 runs.
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(() => p, /AbortError/);
    assert.strictEqual(calls, 1);
  });
});

describe("agents/retry sleep", () => {
  let timers: NodeJS.Timeout[] = [];
  before(() => {
    // keep a handle so we can clear if a test aborts mid-flight
  });
  after(() => {
    timers.forEach(clearTimeout);
  });

  it("resolves after approximately the requested delay", async () => {
    const start = Date.now();
    await sleep(5);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 3, `expected >=3ms, got ${elapsed}`);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => sleep(1000, controller.signal), /AbortError/);
  });

  it("rejects when the signal aborts during the wait", async () => {
    const controller = new AbortController();
    const p = sleep(10_000, controller.signal);
    setTimeout(() => controller.abort(), 5);
    await assert.rejects(() => p, /AbortError/);
  });
});
