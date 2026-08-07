# /services/api-gateway — Route Catalog

**Owner:** CTO · **Ops owner:** COO  
**Version:** 1.0.0  
**Port:** 8080 (prod) / 18080 (dev)

## Overview

The API Gateway is the single ingress for all ForgeOS services. It provides:
- Stable, versioned public routes
- Bearer-token auth (`CONSOLE_TOKEN`) propagation
- Rate limiting per route
- Health aggregation (`/healthz`)

## Upstream Services

| ID | Address | Purpose |
|----|---------|---------|
| `brain_console` | `http://127.0.0.1:7777` | Governance, brain, search, missions |
| `lifeos` | `http://127.0.0.1:3001` | LifeOS calendar/routines |
| `poolleague` | `http://127.0.0.1:3002` | Pool League scoring |

## Route Catalog

| ID | Method | Path | Upstream | Auth | Rate limit | Description |
|----|--------|------|----------|------|------------|-------------|
| r1 | GET | `/healthz` | self | — | 10/min | Gateway health |
| r2 | GET | `/api/status` | brain_console | Bearer | 20/min | System status |
| r3 | GET | `/api/health` | brain_console | — | 10/min | Health probe |
| r4 | GET | `/api/health/detailed` | brain_console | Bearer | 5/min | Detailed health |
| r5 | POST | `/api/agent/dispatch` | brain_console | Bearer | 5/min | Dispatch mission |
| r6 | GET | `/api/agent/:id/status` | brain_console | Bearer | 20/min | Mission status |
| r7 | GET | `/api/agent/:id/log` | brain_console | Bearer | 10/min | Mission log stream |
| r8 | POST | `/api/capture` | brain_console | Bearer | 2/min | Capture page |
| r9 | POST | `/api/embed` | brain_console | Bearer | 1/min | Re-embed knowledge |
| r10 | GET | `/api/search` | brain_console | — | 10/min | Semantic search |
| r11 | GET | `/api/governance` | brain_console | — | 10/min | Governance tree |
| r12 | GET | `/api/roles` | brain_console | — | 10/min | C-suite roles |
| r13 | GET | `/api/vault` | brain_console | Bearer | 10/min | Vault listing |
| r14 | GET | `/api/audit` | brain_console | Bearer | 10/min | Audit log |
| r15 | GET | `/api/decisions` | brain_console | Bearer | 10/min | Decision ledger |
| r16 | GET | `/api/missions` | brain_console | Bearer | 10/min | Mission center |
| r17 | GET | `/api/plugins` | brain_console | Bearer | 10/min | Plugin registry |
| r18 | GET | `/api/webhooks` | brain_console | Bearer | 10/min | Webhook subscriptions |
| r19 | GET | `/api/marketplace` | brain_console | — | 20/min | Marketplace listings |
| r20 | POST | `/api/marketplace/subscribe` | brain_console | Bearer | 5/min | Subscribe capability |
| r21 | GET | `/api/request-log` | brain_console | Bearer | 5/min | Request log |

## Auth

- Pass `Authorization: Bearer <CONSOLE_TOKEN>` on protected routes.
- The gateway validates the header and forwards `x-request-id` for tracing.
- Token is set via `CONSOLE_TOKEN` env var on both gateway and upstream.

## Rate Limits

- Exceeding limits returns `429` with `Retry-After` header.
- Bursts: `rate_limit_burst` in `manifest.json` (default 5).
- Per-route limits are defined in `manifest.json`.

## SLA

- Uptime target: 99.9% (CTO-owned).
- p99 latency: 200ms (measured at gateway egress).
- Rollout gated by COO; breaking changes require ADR.

## Deploy

See `infrastructure/docker/` for multi-stage container + `docker-compose.yml`.
