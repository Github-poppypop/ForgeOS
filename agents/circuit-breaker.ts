/**
 * agents/circuit-breaker.ts — Circuit breaker for repeated gbrain / aider CLI failures.
 *
 * Backlog item #22 ("Circuit breaker for repeated gbrain failures").
 *
 * Pairs with `retry.ts` (#21): `withRetry` handles *transient* blips with
 * backoff, while this breaker detects a *sustained* outage (the same command
 * failing over and over) and stops hammering a dead dependency. It is used to
 * protect the gbrain/aider CLI spawns in `self-improve-loop.ts` so a wedged
 * subprocess or a hard dependency failure fails fast instead of burning the
 * retry budget and stalling the loop.
 *
 * Design notes:
 * - Dependency-free, framework-agnostic. The only injected seam is `now()`
 *   (a monotonic ms clock) so tests can drive transitions without real waits.
 * - Three states:
 *     CLOSED      — calls pass through; N consecutive failures trip to OPEN.
 *     OPEN        — calls rejected immediately with `CircuitOpenError` until
 *                   `cooldownMs` elapses, then it probes HALF_OPEN.
 *     HALF_OPEN   — a single trial call; success(es) close it, any failure
 *                   re-opens. Prevents flapping on a still-dead dependency.
 * - `call()` is the primary API. The breaker instance MUST be shared across
 *   the calls it protects (it is stateful); construct once and reuse, exactly
 *   like you would a connection pool.
 */

export type CircuitState = "closed" | "open" | "half-open";

/** Thrown when `call()` is invoked while the breaker is OPEN (fast-fail). */
export class CircuitOpenError extends Error {
  constructor(message = "Circuit breaker is open") {
    super(message);
    this.name = "CircuitOpenError";
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures in CLOSED that trip to OPEN. Minimum 1. Default 5. */
  failureThreshold?: number;
  /** Consecutive successes in HALF_OPEN required to return to CLOSED. Default 1. */
  successThreshold?: number;
  /** ms the breaker stays OPEN before probing HALF_OPEN. Default 30000. */
  cooldownMs?: number;
  /** Notified on every state transition (from -> to). */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Monotonic clock in ms (injectable for tests). Defaults to Date.now. */
  now?: () => number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly cooldownMs: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 5);
    this.successThreshold = Math.max(1, options.successThreshold ?? 1);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 30_000);
    this.onStateChange = options.onStateChange;
    this.now = options.now ?? Date.now;
  }

  /** Current breaker state. */
  getState(): CircuitState {
    return this.state;
  }

  /** True while the breaker will reject calls with `CircuitOpenError`. */
  isOpen(): boolean {
    this.maybeHalfOpen();
    return this.state === "open";
  }

  /**
   * Run `fn` under the breaker. Resolves with the result on success; rethrows
   * the underlying error on failure (after updating breaker state). Throws
   * `CircuitOpenError` immediately when the breaker is OPEN, WITHOUT invoking
   * `fn` (fast-fail).
   */
  async call<T>(fn: () => Promise<T> | T): Promise<T> {
    this.maybeHalfOpen();
    if (this.state === "open") {
      throw new CircuitOpenError();
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /** Force the breaker back to CLOSED and clear counters (manual recovery). */
  reset(): void {
    this.transition("closed");
  }

  /** Promote OPEN -> HALF_OPEN once the cooldown has elapsed. */
  private maybeHalfOpen(): void {
    if (this.state === "open" && this.now() - this.openedAt >= this.cooldownMs) {
      this.transition("half-open");
    }
  }

  private transition(to: CircuitState): void {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    if (to === "open") this.openedAt = this.now();
    if (to === "half-open" || to === "closed") {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
    }
    this.onStateChange?.(from, to);
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.consecutiveSuccesses += 1;
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.transition("closed");
      }
    } else {
      // A success in CLOSED clears any accumulated failure pressure.
      this.consecutiveFailures = 0;
    }
  }

  private onFailure(): void {
    if (this.state === "half-open") {
      this.transition("open");
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.transition("open");
    }
  }
}
