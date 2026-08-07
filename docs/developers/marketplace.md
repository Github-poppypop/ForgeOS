# Developer Guide — Marketplace

**Owner:** CPO · **Economics co-owner:** CFO  
**Purpose:** Publish and consume capabilities (apps, services, skills) on ForgeOS.

---

## Anatomy of a Listing

Every listing lives under `marketplace/listings/<id>/`:

```
marketplace/listings/<id>/
  manifest.json    # id, type, owner, version, pricing, deps
  README.md        # human summary
  icon.png         # optional (128×128)
```

### manifest.json Schema

```json
{
  "id": "forgeos-brain-console",
  "type": "app",
  "version": "1.0.0",
  "owner": "CTO",
  "pricing": {
    "model": "flat",
    "price_usd": 0,
    "fee_percent": 5,
    "currency": "USD"
  },
  "dependencies": ["ollama", "gbrain"],
  "runtime": "node:20-alpine",
  "entry": "/app/server.ts",
  "health": "/api/health"
}
```

## Pricing Models

- `flat` — fixed per-seat or per-instance fee
- `metered` — billed per invocation (requires `/api/usage` reporting)
- `free` — no charge; default for internal org capabilities

## Consumption

1. Browse `GET /api/marketplace` (or `/marketplace/listings/`).
2. Subscribe via `POST /api/marketplace/subscribe` with `{ listing_id, plan }`.
3. The gateway forwards the request and the runtime installs the dependency.

## Economics

See `marketplace/economics.md` for fees, budgets, and revenue-share model.

## Lifecycle

| State | Meaning |
|-------|---------|
| `draft` | Work in progress |
| `published` | Available for consumption |
| `deprecated` | Scheduled for removal |
| `archived` | Removed from active index |

Deprecated listings emit a warning header (`X-Listing-Status`) for 90 days before archival.
