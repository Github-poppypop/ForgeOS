/**
 * src/server/features/feat-csrf.ts — Auto-loaded by loadServerFeatures.
 * Enforces CSRF double-submit on state-changing routes (closes SECURITY-GAPS
 * #5). Exposes GET /api/csrf/token to mint a token + cookie. Bearer-auth'd
 * machine requests and safe methods are exempt. No edit to runtime.ts required.
 */
import type { Router, Request, Response } from "express";
import { createCsrfMiddleware, CSRF_COOKIE, CSRF_HEADER } from "../csrf.js";

const csrf = createCsrfMiddleware();

export default function registerCsrf(router: Router): void {
  router.get("/api/csrf/token", (_req: Request, res: Response) => {
    const token = csrf.issueToken(res);
    res.json({ token, header: CSRF_HEADER, cookie: CSRF_COOKIE });
  });
  router.use(csrf.middleware);
}
