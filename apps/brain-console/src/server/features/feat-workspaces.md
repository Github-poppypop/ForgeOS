# feat-workspaces

> Server feature — `src/server/features/feat-workspaces.ts`

Server feature: multi-agent collaboration via shared workspaces (in-memory, mock-first). Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts. Provides workspace CRUD + member join/leave + an append-only activity feed.

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/workspaces` |
| POST | `/api/workspaces` |
| GET | `/api/workspaces/:id/members` |
| POST | `/api/workspaces/:id/members` |
| POST | `/api/workspaces/:id/feed` |
| GET | `/api/workspaces/:id/feed` |

---

_Auto-generated from source. Edit the module to change behaviour._
