# feat-alert-status

> Server feature — `src/server/features/feat-alert-status.ts`

Server feature: alerting configuration status + self-test endpoint. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts. Closes the "Add config-status + test endpoint" backlog gap. It mirrors the env-gated alertError() dispatch in server.ts so a self-test fires the SAME outbound Sentry/webhook request a real error would (without depending on server.ts internals, which are not exported).

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/alerting/status` |
| POST | `/api/alerting/test` |

---

_Auto-generated from source. Edit the module to change behaviour._
