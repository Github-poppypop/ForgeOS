# /marketplace/economics — Pricing, Fees, and Budgeting Model

**Owner:** CFO · **Co-owner:** CPO  
**Purpose:** Canonical economics model for ForgeOS marketplace capabilities.

---

## 1. Pricing Models

| Model | Description | Use case |
|-------|-------------|----------|
| `flat` | Fixed per-seat or per-instance fee | SaaS plugins, managed services |
| `metered` | Billed per invocation or unit of consumption | Embedding API, search quota |
| `free` | No charge | Internal org capabilities, open-source tools |

## 2. Platform Fees

| Tier | Platform cut | Conditions |
|------|-------------|------------|
| External paid | 5% gross | Any listing with `price_usd > 0` |
| Internal org | 3% gross | Listing owner is an org role (CEO/CTO/CPO/etc.) |
| Open-source | 0% | Listing `license` is `OSI-approved` |

Payment processing fees (Stripe/Paddle) are passed through to the consumer.

## 3. Revenue Share

- **Owner** receives 97% (external) or 97% (internal) minus processing fees.
- **Platform** retains 3% (internal) or 5% (external).
- **Payouts:** Monthly, net-30. Minimum payout threshold: $50.

## 4. Budgets & Caps

Budgets are defined per listing in `manifest.json`:

```json
"budget": {
  "monthly_cap_usd": 500,
  "alert_at_percent": 80,
  "auto_throttle": true
}
```

### Budget Rules

- **Monthly cap** — hard ceiling; the runtime throttles to 0 once reached.
- **Alert at 80%** — emits `X-Budget-Alert: true` header on responses.
- **Auto-throttle** — when cap is hit, the capability returns `503` with `Retry-After: 86400` until the next billing window.
- **Overrides** — CFO or owner can raise the cap via `POST /api/marketplace/budget/override`.

## 5. Volume Discounts

| Seats | Discount |
|-------|----------|
| 1–99 | 0% |
| 100–499 | 10% |
| 500+ | Custom (CFO negotiation) |

Discounts apply at checkout, not at listing time.

## 6. Metering

Metered listings must emit usage events:

```http
POST /api/usage
Authorization: Bearer <token>
Content-Type: application/json

{
  "listing_id": "forgeos-brain-console",
  "units": 1,
  "unit_type": "request"
}
```

Missing events for a billing cycle fall back to `flat` pricing for that cycle.

## 7. Deprecation & Archival

- Published listings are deprecated with a 7-day notice.
- During deprecation, consumers see `X-Listing-Status: deprecated`.
- After 90 days, the listing is archived and removed from the active index.

## 8. Compliance

- External listings require CFO sign-off before `published`.
- Pricing changes require a 7-day notice to active subscribers.
- All prices are in USD; currency conversion is at consumer checkout.
