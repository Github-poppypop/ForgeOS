# feat-ratelimit-telemetry

> Server feature — `src/server/features/feat-ratelimit-telemetry.ts`

Server feature: per-route HTTP 429 enforcement telemetry. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts / server.ts / ratelimit.ts.  ratelimit.ts already counts hits/blocked for the three routes the limiter is mounted on (getRateLimitSnapshot -> /api/rate-limit/status), but nothing exports how many 429s each request path actually received once enforcement fired. This feature observes finished responses passively via res.once('finish'): it never short-circuits, never rejects, never mutates the limiter's own state, and never inspects bodies -- so existing rate limiting behaves byte-for-byte as before. It also records 429s emitted by ANY source (limiter, upstream proxy, a future per-route limiter), not just ratelimit.ts.  Ordering note: loader.ts is awaited at the TOP of createRuntime(), before the router.use(..., rateLimit()) lines and before every /api route is registered. Registering the observer with router.use() here therefore places it AHEAD of those handlers in the router stack, which is required for the 'finish' listener to be attached before a downstream handler ends the response with a 429.

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/rate-limit/telemetry` |

---

_Auto-generated from source. Edit the module to change behaviour._
