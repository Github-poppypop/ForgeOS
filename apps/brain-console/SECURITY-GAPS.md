# Brain Console — Security Gap Notes (REFRESHED 2026-08-24)

Verified live in `apps/brain-console/server.ts` against a running :7777 instance.

## Implemented (prior "gaps" are now closed)
- **Security headers**: `applySecurityHeaders` sets `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (geolocation/microphone/camera disabled),
  `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, and a
  `Content-Security-Policy` (default-src 'self', fonts/srcs allowlisted for the
  Google Fonts CDN).
- **Structured logging**: `structuredLog()` writes daily-rotated JSON to `logs/`
  (gitignored). One JSON line per request with method/path/status/ms/ip.
- **Alerting hook**: `alertError()` (Sentry or webhook) fires on `level === 'error'`
  from `structuredLog`. **Silent no-op unless `SENTRY_DSN` or `ALERT_WEBHOOK_URL`
  is set** — uses global `fetch`, no dependency.
- **Rate limiting**: in-memory limiter (`src/server/ratelimit.ts`) on
  `/api/feedback`, `/api/telemetry`, `/api/self-improve/learning-loop` with a
  `/api/rate-limit/status` snapshot endpoint. Disable via `RATE_LIMIT_DISABLED=1`.

## Remaining recommendations
1. **Reverse proxy**: if fronted by nginx/Cloudflare, let it own HSTS/CDN/WAF.
2. **Activate alerting**: set `SENTRY_DSN` or `ALERT_WEBHOOK_URL` in the VPS env so
   `alertError` actually delivers.

> Auth, CORS, and CSRF (previously listed here) are now IMPLEMENTED and verified:
> - **Auth gate** (`feat-auth-gate.ts` / `authGate.ts`): env-gated — enforces a
>   `CONSOLE_TOKEN` (or `JWT_SECRET`-signed login token) on all `/api/*` except the
>   public allowlist (`/api/health`, `/api/auth/login`, `/api/stream`,
>   `/api/csrf/token`). No-op when neither env var is set (dev stays open). Verified
>   live: `noTok=401, withTok=200, wrongTok=401`.
> - **CORS restriction** (`feat-cors.ts` / `cors.ts`): when `ALLOWED_ORIGINS` is set,
>   only those origins are permitted; permissive when unset.
> - **CSRF enforcement** (`feat-csrf.ts` / `csrf.ts`): double-submit cookie on
>   POST/PUT/PATCH/DELETE, env-gated to `CONSOLE_TOKEN` (no-op in dev/tests so the
>   existing suite passes).
