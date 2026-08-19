// CSP Enforce feature — conflict-free.
// Moves the app's Content-Security-Policy from report-only behaviour to a fully
// ENFORCED policy (the same functional policy server.ts already emits, with the
// font-CDN allowances preserved) and adds enforcement telemetry: a report-uri /
// report-to sink that captures browser CSP violation reports.
//
// Registered as a server feature: default-exports (router) => void and is auto-loaded
// by features/loader.ts. DOES NOT edit server.ts. The override middleware runs inside
// the runtime router (mounted after the global security-headers middleware), so it
// re-sets the response CSP to the enforced policy for every request.
import express from 'express';
import type { Router } from 'express';

// Enforced policy mirrors server.ts but appends reporting directives.
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
  "report-to csp-endpoint",
].join('; ');

// In-memory violation telemetry.
const cspViolations: Array<Record<string, unknown>> = [];
const CSP_REPORT_TO =
  '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}]}';

export default function registerCspEnforce(router: Router): void {
  // Override the response CSP header with the enforced policy on every response.
  router.use((_req, res, next) => {
    res.set('Content-Security-Policy', CSP_POLICY);
    res.set('Report-To', CSP_REPORT_TO);
    next();
  });

  // Current enforced policy, for the client feature to display.
  router.get('/api/security/headers', (_req, res) => {
    res.json({ csp: CSP_POLICY });
  });

  // In-memory count of captured violations.
  router.get('/api/csp-report/count', (_req, res) => {
    res.json({ count: cspViolations.length });
  });

  // Violation report sink. Accepts application/csp-report and application/json.
  router.post(
    '/api/csp-report',
    express.json({ type: ['application/json', 'application/csp-report'] }),
    (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const report = (body['csp-report'] as Record<string, unknown>) ?? body;
      cspViolations.push({ ts: new Date().toISOString(), ...report });
      // Keep the in-memory buffer bounded.
      if (cspViolations.length > 1000) cspViolations.splice(0, cspViolations.length - 1000);
      console.warn('[csp-enforce] violation report captured:', JSON.stringify(report));
      res.status(204).end();
    }
  );
}
