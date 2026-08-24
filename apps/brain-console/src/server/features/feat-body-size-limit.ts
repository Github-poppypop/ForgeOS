/**
 * src/server/features/feat-body-size-limit.ts — Auto-loaded by
 * loadServerFeatures. Guards every mutating request against oversized bodies
 * (413 + socket abort) before express.json() parses. No edit to runtime.ts
 * required. Max configurable via MAX_BODY_BYTES (default 1MiB).
 */
import type { Router } from "express";
import { createBodySizeLimit } from "../bodySizeLimit.js";

export default function registerBodySizeLimit(router: Router): void {
  router.use(createBodySizeLimit());
}
