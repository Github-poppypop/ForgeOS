/**
 * src/server/features/feat-tracing.ts — Auto-loaded by loadServerFeatures.
 * Applies the real request-tracing middleware to every route so each request
 * carries an `x-trace-id` (honoring inbound ids). No edit to runtime.ts needed.
 */
import type { Router } from "express";
import { createTracingMiddleware } from "../tracing.js";

export default function registerTracing(router: Router): void {
  router.use(createTracingMiddleware());
}
