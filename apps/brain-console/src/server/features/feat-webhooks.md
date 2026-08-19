# feat-webhooks

> Server feature — `src/server/features/feat-webhooks.ts`

Server feature: outbound webhook registry + delivery self-test. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts. Closes the "Webhook management UI" backlog gap. Webhooks persist to data/webhooks.json (gitignored runtime artifact, like store.json).

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/webhooks` |
| POST | `/api/webhooks` |
| POST | `/api/webhooks/:id/test` |
| DELETE | `/api/webhooks/:id` |
| POST | `/api/webhooks/publish` |
| POST | `/api/webhooks/echo` |

---

_Auto-generated from source. Edit the module to change behaviour._
