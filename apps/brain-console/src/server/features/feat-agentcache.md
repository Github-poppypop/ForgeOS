# feat-agentcache

> Server feature — `src/server/features/feat-agentcache.ts`

Server feature: in-memory agent memory cache with per-key TTL and LRU-ish eviction. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts. Closes backlog item #25 (agent memory cache with TTL eviction).

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/agent-cache/meta` |
| GET | `/api/agent-cache` |
| GET | `/api/agent-cache/:key` |
| POST | `/api/agent-cache` |
| DELETE | `/api/agent-cache/:key` |

---

_Auto-generated from source. Edit the module to change behaviour._
