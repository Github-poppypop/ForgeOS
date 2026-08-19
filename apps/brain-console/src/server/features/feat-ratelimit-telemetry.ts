// Server feature: per-route HTTP 429 enforcement telemetry.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts / server.ts / ratelimit.ts.
//
// ratelimit.ts already counts hits/blocked for the three routes the limiter is mounted on
// (getRateLimitSnapshot -> /api/rate-limit/status), but nothing exports how many 429s each
// request path actually received once enforcement fired. This feature observes finished
// responses passively via res.once('finish'): it never short-circuits, never rejects, never
// mutates the limiter's own state, and never inspects bodies -- so existing rate limiting
// behaves byte-for-byte as before. It also records 429s emitted by ANY source (limiter,
// upstream proxy, a future per-route limiter), not just ratelimit.ts.
//
// Ordering note: loader.ts is awaited at the TOP of createRuntime(), before the
// router.use(..., rateLimit()) lines and before every /api route is registered. Registering
// the observer with router.use() here therefore places it AHEAD of those handlers in the
// router stack, which is required for the 'finish' listener to be attached before a
// downstream handler ends the response with a 429.
import type { Router, Request, Response, NextFunction } from 'express';

interface RouteCounter {
  count429: number;
  lastAt: string;
}

/** Process-local, resets on restart -- same lifetime/semantics as ratelimit.ts state. */
const counters: Record<string, RouteCounter> = {};
let lastEventAt: string | null = null;

/** Bound memory so a path-fuzzing client cannot grow the map without limit. */
const MAX_TRACKED_ROUTES = 500;

function normalizePath(req: Request): string {
  const raw = req.originalUrl || req.url || req.path || '/';
  const path = raw.split('?')[0].split('#')[0];
  if (!path) return '/';
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function record(path: string): void {
  const now = new Date().toISOString();
  const existing = counters[path];
  if (existing) {
    existing.count429 += 1;
    existing.lastAt = now;
  } else {
    if (Object.keys(counters).length >= MAX_TRACKED_ROUTES) return;
    counters[path] = { count429: 1, lastAt: now };
  }
  lastEventAt = now;
}

export interface RateLimitTelemetrySnapshot {
  ok: true;
  perRoute: Record<string, RouteCounter>;
  total429: number;
  trackedRoutes: number;
  /** ISO timestamp of the most recent 429 seen, or null if enforcement never fired. */
  lastEventAt: string | null;
  /** ISO timestamp this snapshot was generated. */
  updatedAt: string;
}

/** Raw snapshot -- exported so tests and other features can read it without HTTP. */
export function get429Telemetry(): RateLimitTelemetrySnapshot {
  const perRoute: Record<string, RouteCounter> = {};
  let total429 = 0;
  for (const [path, entry] of Object.entries(counters)) {
    perRoute[path] = { count429: entry.count429, lastAt: entry.lastAt };
    total429 += entry.count429;
  }
  return {
    ok: true,
    perRoute,
    total429,
    trackedRoutes: Object.keys(perRoute).length,
    lastEventAt,
    updatedAt: new Date().toISOString(),
  };
}

/** Observe-only middleware: attach the finish listener, then always continue. */
function observe429(req: Request, res: Response, next: NextFunction): void {
  // Capture the path up front; nested routers can rewrite req.url before 'finish'.
  const path = normalizePath(req);
  res.once('finish', () => {
    if (res.statusCode === 429) record(path);
  });
  next();
}

export default function registerRateLimitTelemetry(router: Router): void {
  // Registered before the limiter/routes that createRuntime() adds after loadServerFeatures().
  router.use(observe429);

  router.get('/api/rate-limit/telemetry', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(get429Telemetry());
  });
}
