/**
 * src/server/persistentMemory.ts — Disk-backed agent memory store.
 *
 * The brain-console previously only had a volatile in-memory TTL cache for agent
 * memory (see agents/memory-cache.ts), which is lost on every restart. This
 * module provides a real persistence layer: a JSON-file-backed key/value store
 * with TTL semantics, atomic writes (temp + rename), and lazy expiry. It is
 * dependency-free (Node built-ins only) so it ships without new npm packages.
 *
 * Use `createPersistentMemoryStore()` and pass it in via the loader so handlers
 * can read/write memory that survives a pm2 restart.
 */
import fs from "node:fs";
import path from "node:path";

export interface MemoryRecord<T = unknown> {
  value: T;
  expiresAt: number; // epoch ms; <= 0 means no expiry
}

export interface PersistentMemoryOptions {
  /** Directory where the store file lives. */
  dir?: string;
  /** File name for the store. */
  file?: string;
  /** Default TTL in ms; 0 = never expire. */
  defaultTtlMs?: number;
}

export interface PersistentMemoryStore {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T, ttlMs?: number): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  keys(): string[];
  size(): number;
  clear(): void;
  /** Evict expired entries; returns count evicted. */
  evict(): number;
  /** Reload from disk (e.g. after an external update). */
  reload(): void;
  /** Persist current in-memory state to disk. */
  flush(): void;
}

export function createPersistentMemoryStore(
  options: PersistentMemoryOptions = {}
): PersistentMemoryStore {
  const dir = options.dir ?? path.resolve(process.cwd(), "data");
  const file = options.file ?? "agent-memory.json";
  const defaultTtlMs = options.defaultTtlMs ?? 0;
  const filePath = path.join(dir, file);

  type Internal = Record<string, MemoryRecord>;
  let data: Internal = {};

  function ensureDir(): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function load(): Internal {
    try {
      if (!fs.existsSync(filePath)) return {};
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Internal;
      return {};
    } catch {
      return {};
    }
  }

  function persist(): void {
    ensureDir();
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  }

  data = load();

  function isLive(rec: MemoryRecord | undefined): rec is MemoryRecord {
    if (!rec) return false;
    if (rec.expiresAt > 0 && Date.now() > rec.expiresAt) {
      return false;
    }
    return true;
  }

  return {
    get<T = unknown>(key: string): T | undefined {
      const rec = data[key];
      if (!isLive(rec)) {
        if (rec) delete data[key];
        return undefined;
      }
      return rec.value as T;
    },
    set<T = unknown>(key: string, value: T, ttlMs?: number): void {
      const ttl = ttlMs ?? defaultTtlMs;
      data[key] = { value, expiresAt: ttl > 0 ? Date.now() + ttl : 0 };
      persist();
    },
    has(key: string): boolean {
      return isLive(data[key]);
    },
    delete(key: string): boolean {
      if (!(key in data)) return false;
      delete data[key];
      persist();
      return true;
    },
    keys(): string[] {
      // Filter out lazily-expired keys.
      const live = Object.keys(data).filter((k) => isLive(data[k]));
      return live;
    },
    size(): number {
      return this.keys().length;
    },
    clear(): void {
      data = {};
      persist();
    },
    evict(): number {
      const now = Date.now();
      let evicted = 0;
      for (const [k, rec] of Object.entries(data)) {
        if (rec.expiresAt > 0 && now > rec.expiresAt) {
          delete data[k];
          evicted++;
        }
      }
      if (evicted > 0) persist();
      return evicted;
    },
    reload(): void {
      data = load();
    },
    flush(): void {
      persist();
    },
  };
}
