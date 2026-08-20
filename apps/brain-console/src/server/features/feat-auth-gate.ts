/**
 * src/server/features/feat-auth-gate.ts — Auto-loaded by loadServerFeatures.
 * Enforces the API token-auth gate when CONSOLE_TOKEN / JWT_SECRET are set
 * (closes SECURITY-GAPS #1). No-op when neither is configured, so the existing
 * open dev server keeps working. No edit to runtime.ts required.
 */
import type { Router } from "express";
import { createAuthGate } from "../authGate.js";

const gate = createAuthGate();

export default function registerAuthGate(router: Router): void {
  router.use(gate.middleware);
}

export { gate };
