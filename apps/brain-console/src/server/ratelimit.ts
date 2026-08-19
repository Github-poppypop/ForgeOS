/**
 * src/server/ratelimit.ts — Lightweight in-memory rate limiter.
 *
 * Protects public, unauthenticated mutation endpoints from abuse. State is
 * process-local (resets on restart) — sufficient for a single-node console.
 * No external dependency. Disable via RATE_LIMIT_DISABLED=1 or NODE_ENV=test.
 */
import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const MAX = Number(process.env.RATE_LIMIT_MAX ?? 120);
const DISABLED = process.env.RATE_LIMIT_DISABLED === "1" || process.env.NODE_ENV === "test";

interface ClientHit { count: number; resetAt: number; }
interface RouteStat { hits: number; blocked: number; }

const clients = new Map<string, ClientHit>();
const routeStats = new Map<string, RouteStat>();

function clientKey(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length) return String(fwd[0]).trim();
  return req.ip ?? "unknown";
}

function statFor(route: string): RouteStat {
  let s = routeStats.get(route);
  if (!s) {
    s = { hits: 0, blocked: 0 };
    routeStats.set(route, s);
  }
  return s;
}

export function rateLimit(options?: { max?: number; windowMs?: number }) {
  const max = options?.max ?? MAX;
  const windowMs = options?.windowMs ?? WINDOW_MS;
  return (req: Request, res: Response, next: NextFunction) => {
    if (DISABLED) return next();
    const key = clientKey(req);
    const route = (req.originalUrl || req.url || "/").split("?")[0];
    const stat = statFor(route);
    stat.hits += 1;
    const now = Date.now();
    const hit = clients.get(key);
    if (!hit || hit.resetAt <= now) {
      clients.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    hit.count += 1;
    if (hit.count > max) {
      stat.blocked += 1;
      const retryAfter = Math.max(1, Math.ceil((hit.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ ok: false, error: "rate_limited", retryAfter });
      return;
    }
    next();
  };
}

export function getRateLimitSnapshot() {
  let totalHits = 0;
  let totalBlocked = 0;
  const routes: Record<string, RouteStat> = {};
  for (const [r, s] of routeStats) {
    totalHits += s.hits;
    totalBlocked += s.blocked;
    routes[r] = { hits: s.hits, blocked: s.blocked };
  }
  const topClients = [...clients.entries()]
    .map(([ip, h]) => ({ ip, count: h.count, resetAt: h.resetAt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return {
    enabled: !DISABLED,
    windowMs: WINDOW_MS,
    max: MAX,
    totalHits,
    totalBlocked,
    routes,
    topClients,
  };
}
