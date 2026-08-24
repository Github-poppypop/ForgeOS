/**
 * src/server/features/feat-agent-memory.ts — Auto-loaded by loadServerFeatures.
 * Exposes the persistent agent-memory store over HTTP so agent memory survives
 * a pm2/process restart. No edit to runtime.ts required.
 *
 * Routes (all under /api/agent-memory):
 *   GET    /api/agent-memory/:key        -> { value } | 404
 *   PUT    /api/agent-memory/:key         body { value, ttlMs? }
 *   DELETE /api/agent-memory/:key
 *   GET    /api/agent-memory              -> { keys: string[] }
 */
import type { Router, Response, Request } from "express";
import express from "express";
import { createPersistentMemoryStore, type PersistentMemoryStore } from "../persistentMemory.js";

export default function registerAgentMemory(router: Router): void {
  const store: PersistentMemoryStore = createPersistentMemoryStore({
    dir: process.env.AGENT_MEMORY_DIR ?? undefined,
  });

  router.get("/api/agent-memory", (_req: Request, res: Response) => {
    res.json({ keys: store.keys(), count: store.size() });
  });

  router.get("/api/agent-memory/:key", (req: Request, res: Response) => {
    const key = decodeURIComponent(req.params.key);
    if (!store.has(key)) return res.status(404).json({ error: "not_found" });
    res.json({ key, value: store.get(key) });
  });

  router.put("/api/agent-memory/:key", express.json({ limit: "1mb" }), (req: Request, res: Response) => {
    const key = decodeURIComponent(req.params.key);
    const body = (req.body ?? {}) as { value?: unknown; ttlMs?: number };
    if (!("value" in body)) {
      return res.status(400).json({ error: "missing value" });
    }
    store.set(key, body.value, typeof body.ttlMs === "number" ? body.ttlMs : undefined);
    res.json({ ok: true, key });
  });

  router.delete("/api/agent-memory/:key", (req: Request, res: Response) => {
    const key = decodeURIComponent(req.params.key);
    const ok = store.delete(key);
    res.status(ok ? 200 : 404).json({ ok, key });
  });

  // Background eviction so expired entries don't accumulate forever.
  const interval = setInterval(() => store.evict(), 60_000);
  interval.unref?.();
}
