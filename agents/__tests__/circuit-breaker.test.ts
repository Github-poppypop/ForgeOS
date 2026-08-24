/**
 * agents/__tests__/circuit-breaker.test.ts — tests for agents/circuit-breaker.ts
 *
 * Uses node:test so it runs locally via `npx tsx --test` and is also accepted
 * by Bun (which implements node:test). Covers the circuit-breaker contract for
 * backlog item #22. A controllable clock (`now`) drives OPEN <-> HALF_OPEN
 * transitions with zero real waits.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitState,
} from "../circuit-breaker";

/** Controllable monotonic clock so cooldown transitions are deterministic. */
function makeClock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const FAIL = new Error("boom");

describe("CircuitBreaker", () => {
  it("passes successful calls through and stays CLOSED", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, now: makeClock().now });
    const res = await cb.call(() => "ok");
    assert.strictEqual(res, "ok");
    assert.strictEqual(cb.getState(), "closed");
  });

  it("trips to OPEN after `failureThreshold` consecutive failures", async () => {
    const clock = makeClock();
    const transitions: Array<[CircuitState, CircuitState]> = [];
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      now: clock.now,
      onStateChange: (from, to) => transitions.push([from, to]),
    });
    for (let i = 0; i < 3; i++) {
      await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    }
    assert.strictEqual(cb.getState(), "open");
    assert.deepStrictEqual(transitions, [["closed", "open"]]);
  });

  it("rejects fast with CircuitOpenError while OPEN (does NOT call fn)", async () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ failureThreshold: 2, now: clock.now });
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    assert.strictEqual(cb.getState(), "open");

    let called = false;
    await assert.rejects(
      () => cb.call(() => {
        called = true;
        return "x";
      }),
      (err: unknown) => err instanceof CircuitOpenError
    );
    assert.strictEqual(called, false, "fn must not run while OPEN");
    assert.strictEqual(cb.getState(), "open");
  });

  it("probes HALF_OPEN after cooldown, then CLOSES on success", async () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 1,
      cooldownMs: 1000,
      now: clock.now,
    });
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    assert.strictEqual(cb.getState(), "open");

    clock.advance(1000); // cooldown elapsed
    assert.strictEqual(cb.isOpen(), false, "should have moved to HALF_OPEN");
    assert.strictEqual(cb.getState(), "half-open");

    const res = await cb.call(() => "recovered");
    assert.strictEqual(res, "recovered");
    assert.strictEqual(cb.getState(), "closed");
  });

  it("re-opens when the HALF_OPEN probe fails", async () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 500,
      now: clock.now,
    });
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    assert.strictEqual(cb.getState(), "open");

    clock.advance(500);
    assert.strictEqual(cb.isOpen(), false); // -> half-open
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    assert.strictEqual(cb.getState(), "open");
  });

  it("requires `successThreshold` consecutive successes to close from HALF_OPEN", async () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      cooldownMs: 500,
      now: clock.now,
    });
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    clock.advance(500);
    assert.strictEqual(cb.isOpen(), false); // half-open

    await cb.call(() => "s1");
    assert.strictEqual(cb.getState(), "half-open", "one success is not enough");
    await cb.call(() => "s2");
    assert.strictEqual(cb.getState(), "closed", "second success closes it");
  });

  it("a success in CLOSED resets the consecutive-failure counter", async () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ failureThreshold: 3, now: clock.now });
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    await cb.call(() => "ok"); // resets counter
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    assert.strictEqual(cb.getState(), "closed", "success reset the failure streak");
  });

  it("reset() forces CLOSED and accepts calls again", async () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ failureThreshold: 1, now: clock.now });
    await assert.rejects(() => cb.call(() => Promise.reject(FAIL)), FAIL);
    assert.strictEqual(cb.getState(), "open");
    cb.reset();
    assert.strictEqual(cb.getState(), "closed");
    assert.strictEqual(await cb.call(() => "again"), "again");
  });
});
