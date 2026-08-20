/**
 * src/server/features/feat-readiness.ts — Auto-loaded by loadServerFeatures.
 * Exposes /api/ready (readiness) distinct from /api/health (liveness). No edit
 * to runtime.ts required. Honors a shared shutdown flag so the probe reports
 * not-ready during a graceful shutdown.
 */
import type { Router, Request, Response } from "express";
import { createReadiness } from "../readiness.js";

// Shared shutdown flag, kept in sync with gracefulShutdown via a module-level
// mutable holder so the two modules agree without circular imports.
export const shutdownState = { shuttingDown: false };

const readiness = createReadiness({ isShuttingDown: () => shutdownState.shuttingDown });

export default function registerReadiness(router: Router): void {
  router.get("/api/ready", (_req: Request, res: Response) => {
    const report = readiness.report();
    res.status(report.ready ? 200 : 503).json(report);
  });
}
