/**
 * src/server/requestTimeout.ts — Real, dependency-free request/handler timeout.
 *
 * The brain-console had no per-request handler timeout: a slow or hung handler
 * (infinite loop, stalled upstream fetch, deadlock) would hold the connection
 * open forever and tie up an event-loop worker. This module provides:
 *   - createRequestTimeout(): Express middleware that, after REQUEST_TIMEOUT_MS
 *     (default 30000), destroys the underlying socket so the request is
 *     aborted and the worker is freed. Uses res.on('close') to avoid leaking
 *     the timer if the client disconnects first.
 *   - withTimeout(): a wrapper that runs an async handler and rejects with a
 *     TimeoutError if it exceeds a budget (useful for specific slow routes).
 *
 * This is the genuine gap; it is NOT the startup port-probe setTimeout.
 */
export interface RequestTimeoutOptions {
  /** Budget in ms before the request is aborted. Default 30000. */
  timeoutMs?: number;
  /** Status code returned/implied on timeout. Default 408. */
  statusCode?: number;
  /** Log function. */
  log?: (msg: string) => void;
}

export class RequestTimeoutError extends Error {
  constructor(public readonly ms: number) {
    super(`request exceeded ${ms}ms budget`);
    this.name = "RequestTimeoutError";
  }
}

export function createRequestTimeout(options: RequestTimeoutOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const statusCode = options.statusCode ?? 408;
  const log = options.log ?? ((m: string) => console.warn(`[request-timeout] ${m}`));

  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction): void => {
    // Don't double-arm if already timed out.
    let finished = false;
    const onFinish = () => {
      finished = true;
      clearTimeout(timer);
    };
    res.on("finish", onFinish);
    res.on("close", onFinish);

    const timer = setTimeout(() => {
      if (finished || res.writableEnded) return;
      log(`aborting ${req.method} ${req.originalUrl} after ${timeoutMs}ms`);
      if (!res.headersSent) {
        try {
          res.status(statusCode).setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "request timeout", code: "REQUEST_TIMEOUT" }));
        } catch {
          /* ignore */
        }
      }
      // Destroy the socket to actually free the worker/hang.
      try {
        res.socket?.destroy();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    if (typeof timer.unref === "function") timer.unref();
    next();
  };
}

/**
 * Wrap an async handler so it rejects with RequestTimeoutError if it runs
 * longer than `budgetMs`. The caller (route) can catch and return 408.
 */
export function withTimeout<T>(budgetMs: number, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeoutError(budgetMs)), budgetMs);
    if (typeof timer.unref === "function") timer.unref();
    fn()
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}
