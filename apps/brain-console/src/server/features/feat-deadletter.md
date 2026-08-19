# feat-deadletter

> Server feature — `src/server/features/feat-deadletter.ts`

Server feature: dead-letter queue for failed agent tasks. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts. Provides an in-memory store + REST surface so failed agent tasks can be inspected, retried (simulated re-dispatch), and acknowledged.

## Endpoints

| Method | Path |
|--------|------|
| POST | `/api/agent/deadletter` |
| GET | `/api/agent/deadletter` |
| GET | `/api/agent/deadletter/meta` |
| POST | `/api/agent/deadletter/:id/retry` |
| POST | `/api/agent/deadletter/:id/ack` |

---

_Auto-generated from source. Edit the module to change behaviour._
