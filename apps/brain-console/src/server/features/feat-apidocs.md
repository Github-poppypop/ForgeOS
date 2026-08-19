# feat-apidocs

> Server feature — `src/server/features/feat-apidocs.ts`

Server feature: publish the static OpenAPI document and a self-contained, CSP-safe human-readable API reference at /api/docs. No external CDN — the viewer is vanilla JS, so it works under the strict Content-Security-Policy. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/openapi.json` |
| GET | `/api/docs` |

---

_Auto-generated from source. Edit the module to change behaviour._
