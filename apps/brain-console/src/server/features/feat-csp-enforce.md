# feat-csp-enforce

> Server feature — `src/server/features/feat-csp-enforce.ts`

CSP Enforce feature — conflict-free. Moves the app's Content-Security-Policy from report-only behaviour to a fully ENFORCED policy (the same functional policy server.ts already emits, with the font-CDN allowances preserved) and adds enforcement telemetry: a report-uri / report-to sink that captures browser CSP violation reports.  Registered as a server feature: default-exports (router) => void and is auto-loaded by features/loader.ts. DOES NOT edit server.ts. The override middleware runs inside the runtime router (mounted after the global security-headers middleware), so it re-sets the response CSP to the enforced policy for every request.

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/security/headers` |
| GET | `/api/csp-report/count` |
| POST | `/api/csp-report` |

---

_Auto-generated from source. Edit the module to change behaviour._
