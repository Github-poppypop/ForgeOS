/**
 * src/server/features/feat-request-id.ts — Auto-loaded by loadServerFeatures.
 * Adds request-id correlation: echoes x-trace-id / x-request-id and logs each
 * request with its id so logs correlate to traces. No edit to runtime.ts.
 */
import type { Router, Request, Response, NextFunction } from "express";
import { createRequestId } from "../requestId.js";

export default function registerRequestId(router: Router): void {
  const mw = createRequestId();
  router.use((req: Request, res: Response, next: NextFunction) => mw(req, res, next));
}
