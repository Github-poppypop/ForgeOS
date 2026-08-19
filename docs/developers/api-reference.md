# ForgeOS Brain Console — API Reference

The ForgeOS Brain Console is a REST API that powers governance, missions,
agent dispatch, semantic search, and brain backup for the ForgeOS knowledge
universe. It is served by the `apps/brain-console` application.

- **Base URL:** `http://localhost:7777`
- **Version:** `1.0.0` (OpenAPI `3.0.3`)
- **Served by:** `apps/brain-console`
- **Spec source:** `apps/brain-console/openapi.json`

All endpoints are mounted under the `/api` prefix. Responses are JSON unless
noted otherwise.

---

## Authentication / notes

- The spec declares a `BearerAuth` security scheme: send an HTTP `Authorization`
  header with a console token — `Authorization: Bearer <CONSOLE_TOKEN>`
  (`bearerFormat: CONSOLE_TOKEN`).
- In local development the console may run with auth disabled (the `/api/status`
  payload reports `auth: false`). The bearer scheme is still the contract for
  secured deployments.
- Most GET endpoints return an `ErrorResponse` shape (`{ "error": "..." }`) on
  failure (commonly `400` bad request or `404` not found).
- HTML error pages are not returned; errors are JSON `ErrorResponse` objects.
- For local dev setup and how to run the console, see the
  [onboarding guide](./onboarding-guide.md).

---

## Health

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/health` | Lightweight health check (no gbrain dependency) |
| GET | `/api/health/stream` | SSE live health stream (5s heartbeat) |
| GET | `/api/status` | Brain + console status (console port, gbrain engine, ollama, embedding model, isolation, auth) |

---

## Brains

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/brains` | Multi-brain metadata — current brain plus the brain registry (id, home, role, isolated) |

---

## Roles & Org

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/roles` | C-suite role rows from gbrain (slug, role, reports_to, exists) |
| GET | `/api/org` | Organization roles — hierarchy (id, title, reportsTo, responsibilities) |

---

## Missions

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/missions` | Mission list with optional agent state |
| PATCH | `/api/missions/{id}` | Advance mission status or update progress/phase (status flows proposed→approved→executing→review→done) |

---

## Agents

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/agent/dispatch` | Dispatch an agent to a mission (tmux-backed); body `{ missionId, agent }` |
| GET | `/api/agent/{missionId}/status` | Agent execution status for a mission (pending/running/done/failed) |
| GET | `/api/agent/{missionId}/log` | Last 50 log lines for an agent mission |

---

## Capture & Search

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/capture` | Capture a page into the brain; body `{ slug, type?, body }` |
| GET | `/api/search` | Semantic search via Ollama; query param `q` |
| POST | `/api/embed` | Re-embed all pages (Ollama) |

---

## Pages & Vault

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/page/{slug}` | Get a brain page by slug |
| GET | `/api/vault` | Obsidian vault file list (base, files, git state) |

---

## Ledger, Timeline & Governance

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/ledger` | Decision ledger entries |
| GET | `/api/timeline` | Project timeline items |
| GET | `/api/governance` | Governance source-of-truth index (authority order, tree, git date) |

---

## Audit & Federation

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/audit` | Audit trail (gbrain list --json) |
| GET | `/api/federation` | Brain federation topology (root, model, children) |

---

## Schema & Backup

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/schema` | Active schema pack |
| POST | `/api/backup` | Download brain zip (gzip JSON bundle) — returns `application/gzip` binary |

---

## Diff

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/diff` | Diff two pages — **not implemented** (returns `501`); query params `left`, `right` |

---

## Meta

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/openapi` | Legacy inline OpenAPI summary (use `openapi.json` instead) |

---

## Key data shapes

- **Mission** — `id`, `title`, `status` (proposed/approved/executing/review/done),
  `phase`, `progress` (0–100), `eta`, `dependencies[]`, `owner`.
- **AgentDispatchResponse** — `queued`, `missionId`, `agent`, `session`,
  `logFile`, `decisionSlug`.
- **AgentStatusResponse** — `missionId`, `status` (pending/running/done/failed),
  `agent`, `session`, `startedAt`.
- **CaptureRequest** — `slug`, `type` (default `note`), `body`.
- **HealthResponse** — `ok`, `ts`.
- **StatusResponse** — `console_port`, `gbrain_health{status,engine,owned_by}`,
  `schema`, `ollama`, `embedding_model`, `isolation`, `auth`.
- **ErrorResponse** — `{ "error": "..." }`.

See `apps/brain-console/openapi.json` for the full machine-readable contract.
