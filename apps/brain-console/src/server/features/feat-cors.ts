/**
 * src/server/features/feat-cors.ts — Auto-loaded by loadServerFeatures.
 * Applies origin-restricted CORS. Allowlist comes from CORS_ALLOWED_ORIGINS
 * (comma-separated). No header is emitted for disallowed origins. No edit to
 * runtime.ts required.
 */
import type { Router } from "express";
import { createCorsMiddleware } from "../cors.js";

export default function registerCors(router: Router): void {
  router.use(createCorsMiddleware());
}
