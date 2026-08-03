# Brain Console — Security Gap Notes

Date: 2026-08-03
Mission: CTO-20260803

## Verified working on Linux container
- `node --check src/app.js` passes
- `bun test tests/unit/*.spec.ts` passes (55/55)
- Server boots on port 7777
- Static assets serve with security headers and no-cache
- Health, SPA, and SPA JS are accessible without 5xx

## Current headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Cache-Control: no-cache` on static assets
- `Content-Type: application/json; charset=utf-8` on API

## Gaps / risks
1. **No HSTS**: `Strict-Transport-Security` is absent. If this is fronted by a reverse proxy, it should set HSTS.
2. **No `Referrer-Policy` / `Permissions-Policy`**: Not present. Consider adding a restrictive referrer policy and limiting permissions.
3. **CORS allows `*`**: `access-control-allow-origin: *` is open. For production, restrict origins.
4. **Auth is optional**: Without env-configured secrets, API is open. Ensure `CONSOLE_TOKEN`/`JWT_SECRET` are set in production.
5. **CSRF endpoint exists but is not enforced**: `csrfMiddleware` is defined but not used on POST routes.
6. **SPA fallback leaks index.html for unknown paths**: Likely acceptable for SPA routing but should be confirmed.

## VPS notes
- 6 `/api/*` routes currently return 500 in this container because `bunx gbrain` is unavailable.
- On VPS with gbrain installed, the smoke test should pass all routes.
