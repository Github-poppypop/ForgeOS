# Developer Guide — API Gateway

**Owner:** CTO · **Status:** Draft  
**Purpose:** Route and consume the ForgeOS API Gateway from external apps and scripts.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local (Docker) | `http://localhost:8080` |
| VPS (tmux) | `http://127.0.0.1:8080` |

## Quick Start

```bash
# Health check
curl -s http://localhost:8080/healthz

# Authenticated request
curl -s -H "Authorization: Bearer $CONSOLE_TOKEN" \
  http://localhost:8080/api/status | jq
```

## Routing Rules

- Public routes (search, governance, roles, marketplace) do NOT require a token.
- Protected routes (capture, embed, vault, missions, agent dispatch) require `Authorization: Bearer <token>`.
- The gateway forwards `x-request-id`; include one for traceability.

## Rate Limits

| Route class | Default | Burst |
|-------------|---------|-------|
| Read | 10–20/min | 5 |
| Write (capture) | 2/min | 1 |
| Embed | 1/min | 1 |

When limited, the gateway returns `429` with `Retry-After`.

## Adding a New Route

1. Add entry to `services/api-gateway/manifest.json`.
2. Verify the upstream service exists in `upstream` map.
3. Open an ADR if the route is public-facing.
4. Gate write routes behind `auth: true`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 429 | Back off; respect `Retry-After`. Check burst config. |
| 502 | Upstream not running; verify `brain_console` is up on `:7777`. |
| 401 | Missing/invalid `Authorization: Bearer` header. |
| 504 | Upstream exceeded p99; check `GBRAIN_HOME` health. |
