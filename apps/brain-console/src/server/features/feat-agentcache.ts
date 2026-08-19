// Server feature: in-memory agent memory cache with per-key TTL and LRU-ish eviction.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
// Closes backlog item #25 (agent memory cache with TTL eviction).
import type { Router } from 'express';

const CAP = 1000;
const EVICT_INTERVAL_MS = 5000;

interface Entry {
  value: unknown;
  expiresAt: number; // epoch ms; Infinity when no TTL
  lastUsedAt: number; // epoch ms, bumped on read
}

const cache = new Map<string, Entry>();
let hits = 0;
let misses = 0;
let evictions = 0;

function isExpired(e: Entry): boolean {
  return e.expiresAt <= Date.now();
}

// Background eviction: drop expired keys, then shrink to CAP by least-recently-used.
function sweep(): void {
  const now = Date.now();
  for (const [k, e] of cache) {
    if (e.expiresAt <= now) {
      cache.delete(k);
      evictions++;
    }
  }
  if (cache.size <= CAP) return;
  const ordered = [...cache.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
  const toRemove = cache.size - CAP;
  for (let i = 0; i < toRemove; i++) {
    cache.delete(ordered[i][0]);
    evictions++;
  }
}

const timer = setInterval(sweep, EVICT_INTERVAL_MS);
// Eviction must not keep the process alive on its own.
if (typeof (timer as { unref?: () => void }).unref === 'function') {
  (timer as { unref?: () => void }).unref();
}

export default function registerAgentCache(router: Router): void {
  // Must precede /:key so "meta" is not swallowed as a key.
  router.get('/api/agent-cache/meta', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, size: cache.size, hits, misses, evictions });
  });

  // Collection listing of current (non-expired) keys.
  router.get('/api/agent-cache', (_req, res) => {
    const now = Date.now();
    const keys = [...cache.entries()]
      .filter(([, e]) => e.expiresAt > now)
      .map(([k, e]) => ({ key: k, expiresAt: e.expiresAt }));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, size: keys.length, keys });
  });

  router.get('/api/agent-cache/:key', (req, res) => {
    const key = req.params.key;
    const e = cache.get(key);
    if (!e || isExpired(e)) {
      if (e && isExpired(e)) {
        cache.delete(key);
        evictions++;
      }
      misses++;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(404).json({ ok: false, error: 'not found' });
      return;
    }
    hits++;
    e.lastUsedAt = Date.now();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, key, value: e.value, expiresAt: e.expiresAt });
  });

  router.post('/api/agent-cache', (req, res) => {
    const body = (req.body ?? {}) as { key?: unknown; value?: unknown; ttlSec?: unknown };
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!key) {
      res.status(400).json({ ok: false, error: 'key (non-empty string) is required' });
      return;
    }
    const ttlSec =
      typeof body.ttlSec === 'number' && Number.isFinite(body.ttlSec) ? body.ttlSec : undefined;
    const expiresAt =
      ttlSec !== undefined && ttlSec > 0 ? Date.now() + Math.floor(ttlSec * 1000) : Infinity;
    cache.set(key, { value: body.value, expiresAt, lastUsedAt: Date.now() });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json({ ok: true, key, expiresAt, size: cache.size });
  });

  router.delete('/api/agent-cache/:key', (req, res) => {
    const key = req.params.key;
    const had = cache.delete(key);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ ok: true, deleted: had, size: cache.size });
  });
}
