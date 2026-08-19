# ForgeOS Brain Console — Feature Catalog

Auto-generated index of the conflict-free feature modules under `src/server/features/` and `src/client/src/features/`.

## Server features (API)

| Module | Endpoints | Description |
|--------|-----------|-------------|
| [`feat-agentcache.ts`](src/server/features/feat-agentcache.md) | 5 | Server feature: in-memory agent memory cache with per-key TTL and LRU-ish eviction. Confli… |
| [`feat-alert-status.ts`](src/server/features/feat-alert-status.md) | 2 | Server feature: alerting configuration status + self-test endpoint. Conflict-free: loaded … |
| [`feat-apidocs.ts`](src/server/features/feat-apidocs.md) | 2 | Server feature: publish the static OpenAPI document and a self-contained, CSP-safe human-r… |
| [`feat-auditexport.ts`](src/server/features/feat-auditexport.md) | 1 | Backbone feature bridge: exposes audit-log export (SQL/JSON) built on ../auditExport.ts. S… |
| [`feat-auditstore.ts`](src/server/features/feat-auditstore.md) | 3 | Durable audit-log store with size-based rotation.  This is ADDITIVE and conflict-free: it … |
| [`feat-changelog.ts`](src/server/features/feat-changelog.md) | 1 | Server feature: serve the project CHANGELOG.md as structured JSON at /api/changelog. Confl… |
| [`feat-csp-enforce.ts`](src/server/features/feat-csp-enforce.md) | 3 | CSP Enforce feature — conflict-free. Moves the app's Content-Security-Policy from report-o… |
| [`feat-deadletter.ts`](src/server/features/feat-deadletter.md) | 5 | Server feature: dead-letter queue for failed agent tasks. Conflict-free: loaded by feature… |
| [`feat-graphql.ts`](src/server/features/feat-graphql.md) | 2 | GraphQL endpoint with depth & complexity limiting. Self-contained feature: discovers nothi… |
| [`feat-missionsched-exec.ts`](src/server/features/feat-missionsched-exec.md) | 1 | Server feature: Mission Scheduler EXECUTION engine. Conflict-free: loaded by features/load… |
| [`feat-missionsched.ts`](src/server/features/feat-missionsched.md) | 4 | Server feature: Mission Scheduler store + management API. Conflict-free: loaded by feature… |
| [`feat-pwa.ts`](src/server/features/feat-pwa.md) | 1 | Backbone feature bridge: serves the PWA manifest so /manifest.webmanifest returns 200. Sel… |
| [`feat-ratelimit-telemetry.ts`](src/server/features/feat-ratelimit-telemetry.md) | 1 | Server feature: per-route HTTP 429 enforcement telemetry. Conflict-free: loaded by feature… |
| [`feat-sse.ts`](src/server/features/feat-sse.md) | 0 | Backbone feature bridge: wires the already-implemented SSE hub (../sse.ts) into the runtim… |
| [`feat-webhooks.ts`](src/server/features/feat-webhooks.md) | 6 | Server feature: outbound webhook registry + delivery self-test. Conflict-free: loaded by f… |

## Client features (UI)

| Module | Mount | Label | Category | API calls |
|--------|-------|-------|----------|-----------|
| [`feat-agentcache.tsx`](src/client/src/features/feat-agentcache.md) | `/feature/agent-cache` | Agent Cache | Features | 3 |
| [`feat-alert-status.tsx`](src/client/src/features/feat-alert-status.md) | `/feature/alert-status` | Alerting Status | Observability | 2 |
| [`feat-apidocs.tsx`](src/client/src/features/feat-apidocs.md) | `/feature/api-docs` | API Reference | Developer | 0 |
| [`feat-auditstore.tsx`](src/client/src/features/feat-auditstore.md) | `/feature/audit-store` | Audit Store | Features | 2 |
| [`feat-bulkvault.tsx`](src/client/src/features/feat-bulkvault.md) | `/feature/bulk-vault` | Bulk Vault | Knowledge | 2 |
| [`feat-changelog.tsx`](src/client/src/features/feat-changelog.md) | `/feature/changelog` | What | About | 1 |
| [`feat-csp-enforce.tsx`](src/client/src/features/feat-csp-enforce.md) | `/feature/csp-enforce` | CSP Enforce | Security | 2 |
| [`feat-deadletter.tsx`](src/client/src/features/feat-deadletter.md) | `/feature/dead-letter` | Dead-Letter Queue | Features | 2 |
| [`feat-diffviewer.tsx`](src/client/src/features/feat-diffviewer.md) | `/feature/diff-viewer` | Page Diff Viewer | Knowledge | 0 |
| [`feat-graphql-guard.tsx`](src/client/src/features/feat-graphql-guard.md) | `/feature/graphql-guard` | GraphQL Guard | Features | 2 |
| [`feat-missionsched-exec.tsx`](src/client/src/features/feat-missionsched-exec.md) | `/feature/mission-scheduler-exec` | Scheduler Executions | Features | 2 |
| [`feat-ratelimit-telemetry.tsx`](src/client/src/features/feat-ratelimit-telemetry.md) | `/feature/ratelimit-telemetry` | hot | Observability | 1 |
| [`feat-ratelimit.tsx`](src/client/src/features/feat-ratelimit.md) | `/feature/ratelimit-dash` | Rate-Limit Dashboard | Features | 0 |
| [`feat-sse.tsx`](src/client/src/features/feat-sse.md) | `/feature/sse` | Live Brain Sync | Features | 0 |
| [`feat-template.tsx`](src/client/src/features/feat-template.md) | `/feature/template` | Template Feature | Features | 0 |
| [`feat-webhooks.tsx`](src/client/src/features/feat-webhooks.md) | `/webhooks` | Webhooks | Governance | 2 |
| [`feat-workspaces.tsx`](src/client/src/features/feat-workspaces.md) | `/feature/workspaces` | Shared Workspaces | Features | 2 |

---

_Generated by `scripts/gen-feature-readmes.py`. Regenerate after adding features._
