/**
 * src/server/features/feat-request-timeout.ts — Auto-loaded by
 * loadServerFeatures. Arms a global request/handler timeout so a hung handler
 * cannot hold a connection open forever. Budget via REQUEST_TIMEOUT_MS (default
 * 30000). No edit to runtime.ts required.
 */
import type { Router, Request, Response, NextFunction } from "express";
import { createRequestTimeout } from "../requestTimeout.js";

export default function registerRequestTimeout(router: Router): void {
  const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000);
  const mw = createRequestTimeout({ timeoutMs });
  // Express Router middleware signature is (req,res,next); bind for safety.
  router.use((req: Request, res: Response, next: NextFunction) => mw(req, res, next));
}
