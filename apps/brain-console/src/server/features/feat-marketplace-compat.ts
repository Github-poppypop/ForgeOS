/**
 * src/server/features/feat-marketplace-compat.ts — Auto-loaded by
 * loadServerFeatures. Exposes the real semver compatibility engine at
 * /api/marketplace/compat/v2 (additive — the legacy /api/marketplace/compat
 * regex check in runtime.ts is left untouched). No edit to runtime.ts needed.
 *
 * POST /api/marketplace/compat/v2
 *   body: { engineVersion, engineRange, peers?: { name: {version, range} } }
 *   -> { compatible, reasons }
 */
import type { Router, Request, Response } from "express";
import express from "express";
import { evaluateCompatibility } from "../semverCompat.js";

export default function registerMarketplaceCompat(router: Router): void {
  router.post(
    "/api/marketplace/compat/v2",
    express.json({ limit: "256kb" }),
    (req: Request, res: Response) => {
      const body = (req.body ?? {}) as {
        engineVersion?: string;
        engineRange?: string;
        peers?: Record<string, { version: string; range: string }>;
      };
      if (!body.engineVersion || !body.engineRange) {
        return res
          .status(400)
          .json({ compatible: false, error: "missing engineVersion or engineRange" });
      }
      const result = evaluateCompatibility({
        engineVersion: body.engineVersion,
        engineRange: body.engineRange,
        peers: body.peers,
      });
      res.json(result);
    }
  );
}
