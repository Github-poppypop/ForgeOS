# Brain Console — Security Gap Notes (REFRESHED 2026-08-19)

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
1. **Auth in production**: ensure `CONSOLE_TOKEN` / `JWT_SECRET` are set; API is open
   without them.
2. **CORS**: currently permissive — restrict `access-control-allow-origin` to known
   origins if exposed beyond localhost.
3. **Reverse proxy**: if fronted by nginx/Cloudflare, let it own HSTS/CDN/WAF.
4. **Activate alerting**: set `SENTRY_DSN` or `ALERT_WEBHOOK_URL` in the VPS env so
   `alertError` actually delivers.
5. **CSRF**: `csrfMiddleware` is defined but not enforced on POST routes — enforce or
   document as acceptable for same-origin token-auth API.
