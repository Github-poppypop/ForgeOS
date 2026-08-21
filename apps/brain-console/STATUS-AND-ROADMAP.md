# ForgeOS Brain Console — Status & Roadmap (REFRESHED 2026-08-19)

_Package: `forgeos-brain-console`. Runtime: Node + Express + Vite (Bun removed).
SPA built to `dist/` and served on port **7777** (VPS `root@2.24.100.158:2222`,
repo `/opt/forgeos`). Prior STATUS-AND-ROADMAP.md was stale (referenced Bun and
`src/app.js`); this replaces it._

## 1. Current status — production-ready
| Item | State | Evidence |
|---|---|---|
| Server | **UP** on VPS via PM2 (name `forgeos`) | `curl /api/health` → 200 |
| Port | 7777 (HTTP) | local + VPS |
| SPA | React/Vite client built to `dist/` | `npx tsx server.ts` serves it |
| Build | **GREEN** | `npm run build` exits 0 |
| Tests | **GREEN** | `npm test` 21/21 pass |
| Security headers | **IMPLEMENTED** | CSP/HSTS/X-Frame/Referrer/Permissions in `server.ts` |
| Structured logging | **IMPLEMENTED** | daily JSON in `logs/` (gitignored) |
| Alerting hook | **IMPLEMENTED (env-gated)** | `alertError` fires on error; no-op without `SENTRY_DSN`/`ALERT_WEBHOOK_URL` |
| Rate limiting | **IMPLEMENTED** | in-memory; `/api/rate-limit/status` live |
| Command palette | **IMPLEMENTED** | CMD+K across all routes |
| Onboarding tour | **IMPLEMENTED** | `OnboardingTour` on first load |
| Error boundary | **IMPLEMENTED** | `DebugErrorBoundary` with retry/reload |
| Loading skeletons | **IMPLEMENTED** | `Skeleton` component |
| CSV export | **IMPLEMENTED** | Ledger, Vault, Missions, Audit |
| Column visibility | **IMPLEMENTED** | App Store table toggles |
| A11y | **IMPLEMENTED** | skip-link, aria-live, chart roles/labels |
| OpenAPI | **GENERATED** | `openapi.json` (70+ paths) |
| E2E | **SCAFFOLDED** | Playwright + perf-budget |

## 2. Recently shipped (autonomous driver waves)
- Security headers + structured logging + env-gated alert hook.
- In-memory rate limiting + CSP font-CDN allowance.
- Chart a11y (`role=img` + descriptive aria-labels), `DebugErrorBoundary` polish.
- Playwright e2e + performance budgets.
- CSV export on Ledger; **Vault/Missions/Audit CSV export + live rate-limit card (2026-08-19, commit `e43689b`)**.
- **Reading List panel** (semantic bookmarking + reading-list capture; localStorage; CSV export/import) — Batch D #34, Wave 5 (2026-08-20).
- **Demo Data Seeder panel** (one-click seed of sample data into localStorage-backed features for offline tours) — next-50 #48, Wave 9 (2026-08-20, f864cfa).
- **Page Analytics panel** — `/feature/page-analytics` (Observability): localStorage per-route visit tracker + live `window.__forgeosTelemetry` session metrics (API calls, client errors, mount ms). Conflict-free, no new CSS. Wave 10 (2026-08-20, `2b63f30`); client `tsc --noEmit` + `npx tsx --test` 109/109 green.
- **Page-Mutation Audit CSV/JSON export** — Export buttons on `/feature/audit-trail` download the trail as CSV or JSON (client-side; no new CSS, no server changes). Closes the missing export affordance on the audit panel.

## 3. Backlog (genuine gaps — see `.forgeos-todo.md`)
- OpenTelemetry distributed tracing (SSE live-sync scaffold already shipped in `feat-sse.tsx`).
- Agent runtime hardening: retry/backoff, circuit breaker, sandbox guardrails, output schema validation, cost/token accounting, A/B canary routing, Ollama graceful degradation, runbook auto-select (Batch C 21-24,27-30).
- Knowledge universe: incremental markdown sync, link-health, dup-merge, semantic bookmarking, page analytics, per-role ACL, page-mutation audit viewer, bulk page mover, graph viz (Batch D 31,33-35,37-40).
- Audit export to SQL/JSON — **server-side request-log export shipped** (`/api/audit/export?format=csv|json|sql`, commit `0788701`); Page-Mutation Audit panel now exports its trail as CSV/JSON client-side.
- Marketplace review/approval + capability-compat + publisher analytics; SDK publish helper; first-app template; guided onboarding; role quickstart wizards; demo data seeder; release-notes generator (Batch E 41-48,50).
- Inline decision edit w/ optimistic rollback; table column reorder (Batch B 15,19); wire `ContextMenu` to table rows (Batch B 20).
- Snyk scanning; semantic release; visual regression; load testing; coverage.
- Docker/K8s/Terraform/blue-green/CDN/WAF.
- Published API reference + onboarding docs.

## 4. Run
```bash
cd /opt/forgeos/apps/brain-console
npm run build:client && npx tsx server.ts      # or: pm2 start npx --name forgeos -- tsx server.ts
npm test
# VPS
pm2 restart forgeos && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7777/api/health
```

- Alerting config-status + self-test endpoint shipped (`/api/alerting/status`, `/api/alerting/test`, `/feature/alert-status`).
