/**
 * src/server/idempotency.ts — Real request de-duplication / idempotency layer.
 *
 * Clients send an `Idempotency-Key` header on mutating requests. The first
 * request executes normally and its status + (stringified) body are cached.
 * A replay (same key) within the retention window returns the cached response
 * WITHOUT re-running the handler — preventing duplicate side effects (e.g. a
 * double-submitted /api/ledger POST creating two entries when the client
 * retries on a timeout).
 *
 * Dependency-free. In-memory by default; pass `persistDir` to also survive a
 * restart. Thread-safe enough for single-node Express (Node is single-threaded
 * per event loop; the cache is a plain Map).
 */
import fs from "node:fs";
import path from "node:path";

export interface IdempotencyRecord {
  status: number;
  body: string;
  contentType: string;
  createdAt: number;
  method: string;
}

export interface IdempotencyOptions {
  /** Max age of a cached response, ms. Default 24h. */
  ttlMs?: number;
  /** If set, cached responses are also written to <dir>/idempotency.json. */
  persistDir?: string;
  /** Header clients use. Default Idempotency-Key. */
  header?: string;
  /** Methods eligible for idempotency. Default POST, PATCH, PUT, DELETE. */
  methods?: string[];
}

export interface IdempotencyStore {
  get(key: string): IdempotencyRecord | undefined;
  set(key: string, rec: IdempotencyRecord): void;
  delete(key: string): void;
  /** Remove expired entries; returns count removed. */
  evict(): number;
}

export function createIdempotencyStore(options: IdempotencyOptions = {}): IdempotencyStore {
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
  const dir = options.persistDir;
  const file = dir ? path.join(dir, "idempotency.json") : undefined;

  type Map = Record<string, IdempotencyRecord>;
  let cache: Map = {};

  function load(): Map {
    if (!file) return {};
    try {
      if (!fs.existsSync(file)) return {};
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Map) : {};
    } catch {
      return {};
    }
  }
  function persist(): void {
    if (!file) return;
    try {
      if (!fs.existsSync(dir!)) fs.mkdirSync(dir!, { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(cache), "utf8");
      fs.renameSync(tmp, file);
    } catch {
      /* best-effort */
    }
  }

  cache = load();

  return {
    get(key: string): IdempotencyRecord | undefined {
      const rec = cache[key];
      if (!rec) return undefined;
      if (Date.now() - rec.createdAt > ttlMs) {
        delete cache[key];
        persist();
        return undefined;
      }
      return rec;
    },
    set(key: string, rec: IdempotencyRecord): void {
      cache[key] = rec;
      persist();
    },
    delete(key: string): void {
      if (key in cache) {
        delete cache[key];
        persist();
      }
    },
    evict(): number {
      const now = Date.now();
      let removed = 0;
      for (const [k, rec] of Object.entries(cache)) {
        if (now - rec.createdAt > ttlMs) {
          delete cache[k];
          removed++;
        }
      }
      if (removed > 0) persist();
      return removed;
    },
  };
}

export const IDEMPOTENCY_HEADER = "idempotency-key";

/**
 * Build the Express middleware. `handlerKey` lets callers scope the key per
 * route (default: full originalUrl). Returns middleware that short-circuits
 * replays with the cached response.
 */
export function createIdempotencyMiddleware(options: IdempotencyOptions = {}) {
  const header = (options.header ?? IDEMPOTENCY_HEADER).toLowerCase();
  const methods = (options.methods ?? ["POST", "PATCH", "PUT", "DELETE"]).map((m) =>
    m.toUpperCase()
  );
  const store = createIdempotencyStore(options);

  return (req: any, res: any, next: () => void): void => {
    const method = (req.method ?? "").toUpperCase();
    if (!methods.includes(method)) return next();

    const key = req.headers?.[header];
    if (typeof key !== "string" || key.trim().length === 0) return next();

    const existing = store.get(key);
    if (existing) {
      res.status(existing.status);
      if (existing.contentType) res.setHeader("content-type", existing.contentType);
      res.setHeader("idempotency-replayed", "true");
      res.send(existing.body);
      return;
    }

    // Capture the response so we can cache it on first execution.
    const originalSend = res.send.bind(res);
    res.send = (body: unknown) => {
      try {
        const rec: IdempotencyRecord = {
          status: res.statusCode,
          body: typeof body === "string" ? body : JSON.stringify(body),
          contentType: res.getHeader?.("content-type") ?? "application/json",
          createdAt: Date.now(),
          method,
        };
        store.set(key, rec);
      } catch {
        /* cache best-effort */
      }
      return originalSend(body);
    };

    next();
  };
}
