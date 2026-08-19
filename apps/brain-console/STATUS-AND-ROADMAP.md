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

## 3. Backlog (genuine gaps — see `.forgeos-todo.md`)
- WebSocket/SSE live brain sync; OpenTelemetry tracing.
- Agent memory persistence; mission scheduling; multi-agent workspaces.
- Plugin marketplace registry; audit export to SQL/JSON.
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
