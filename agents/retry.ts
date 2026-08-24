/**
 * agents/retry.ts — Retry / backoff wrapper for transient CLI & process failures.
 *
 * Backlog item #21 ("Retry/backoff wrapper for gbrain CLI spawns").
 *
 * Provides a small, dependency-free `withRetry` primitive that wraps an async
 * operation in exponential backoff with optional jitter, an abort signal, and a
 * caller-supplied `shouldRetry` predicate. It is used to harden the gbrain/aider
 * CLI spawns in `self-improve-loop.ts` against transient failures (EMFILE/EAGAIN
 * spawn errors, SIGKILL timeouts, network blips) WITHOUT masking genuine command
 * failures (a clean non-zero exit is a resolved result, not a retried error).
 *
 * Design notes:
 * - `withRetry` retries only when the operation *throws*. Callers that model a
 *   "real" failure as a resolved value (e.g. `{ ok: false }`) should reject on
 *   the transient path and resolve on the non-retryable path.
 * - `NonRetryableError` and `AbortError` short-circuit immediately.
 * - Backoff is bounded by `maxDelayMs`; jitter widens each interval by ±25%.
 */

export interface RetryOptions {
  /** Total attempts including the first. Minimum 1. Default 3. */
  maxAttempts?: number;
  /** Initial backoff in ms. Default 200. */
  baseDelayMs?: number;
  /** Backoff multiplier applied per attempt. Default 2. */
  factor?: number;
  /** Cap on a single backoff interval in ms. Default 5000. */
  maxDelayMs?: number;
  /** Add randomized jitter (±25%) to each backoff. Default true. */
  jitter?: boolean;
  /** Abort signal; rejects pending sleep + throws on next attempt. */
  signal?: AbortSignal;
  /**
   * Return true to retry the given error on the given 1-based attempt, false to
   * bail immediately. Defaults to retrying everything except `NonRetryableError`
   * and `AbortError`.
   */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Called after each failed (but retried) attempt. */
  onAttempt?: (attempt: number, err: unknown) => void;
}

/** Marker error that signals "do not retry this failure." */
export class NonRetryableError extends Error {
  cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "NonRetryableError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/** Default predicate: retry unless explicitly marked non-retryable / aborted. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof NonRetryableError) return false;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "NonRetryableError")) {
    return false;
  }
  return true;
}

/** Cancellable sleep honoring an AbortSignal (rejects with AbortError). */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Run `fn` (which may be async) with exponential backoff + optional jitter.
 * `fn` receives the 1-based attempt number. Resolves with the first success.
 * Throws the last error after `maxAttempts` or when `shouldRetry` returns false.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T> | T,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 200;
  const factor = options.factor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const jitter = options.jitter ?? true;
  const shouldRetry = options.shouldRetry ?? isRetryable;

  let lastErr: unknown = new Error("withRetry: no attempts executed");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const retry = attempt < maxAttempts && shouldRetry(err, attempt);
      if (!retry) {
        throw err;
      }
      options.onAttempt?.(attempt, err);
      const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(factor, attempt - 1));
      const delay = jitter ? Math.round(exp * (0.75 + Math.random() * 0.5)) : exp;
      await sleep(delay, options.signal);
    }
  }
  // Unreachable: the loop returns on success or throws on the last attempt.
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
