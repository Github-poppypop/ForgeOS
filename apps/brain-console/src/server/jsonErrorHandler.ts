/**
 * src/server/jsonErrorHandler.ts — Real, dependency-free Express error handler
 * for body-parser / JSON failures.
 *
 * The brain-console used express.json() with NO error middleware. On malformed
 * JSON, express.json() throws a SyntaxError that (without a 4-arg handler)
 * surfaces as a 500 and can crash the request pipeline. This module returns a
 * proper 400 for JSON/SyntaxErrors and a 500 for other thrown errors, while
 * emitting a structured log line. Mount it AFTER all routes via
 * app.use(handler) (the loader wires it through the runtime router).
 */
import type { Express, Request, Response, NextFunction } from "express";

export interface JsonErrorHandlerOptions {
  /** Called for every handled error (observability hook). */
  onError?: (info: { status: number; code: string; message: string; method: string; path: string }) => void;
}

export function createJsonErrorHandler(options: JsonErrorHandlerOptions = {}) {
  // Express identifies a body-parser error by the `status === 400` and
  // `type === 'entity.parse.failed'` / `SyntaxError` shape.
  return (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    const e = err as { status?: number; type?: string; message?: string; name?: string };
    const isParseError =
      e instanceof SyntaxError ||
      e?.type === "entity.parse.failed" ||
      (typeof e?.message === "string" && e.message.includes("JSON"));

    const status = isParseError ? 400 : typeof e?.status === "number" ? e.status : 500;
    const code = isParseError ? "BAD_REQUEST_BODY" : "INTERNAL_ERROR";
    const message = isParseError ? "malformed JSON body" : (e?.message ?? "internal error");

    options.onError?.({
      status,
      code,
      message,
      method: _req.method,
      path: _req.originalUrl,
    });

    if (res.headersSent) {
      // Cannot write a new response; just end.
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    res.status(status).setHeader("Content-Type", "application/json");
    res.json({ ok: false, error: message, code });
  };
}

/** Convenience: mount on an Express app. */
export function mountJsonErrorHandler(app: Express, options?: JsonErrorHandlerOptions): void {
  app.use(createJsonErrorHandler(options) as unknown as (req: Request, res: Response, next: NextFunction) => void);
}
