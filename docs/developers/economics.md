# Developer Guide — Marketplace Economics

**Owner:** CFO · **Status:** Draft  
**Purpose:** Understand pricing, fees, budgets, and revenue sharing for ForgeOS marketplace capabilities.

---

## Pricing Models

| Model | Billing | Example |
|-------|---------|---------|
| `flat` | Fixed per-seat or per-instance | $9/seat/month for a plugin |
| `metered` | Per-invocation | $0.01/embed call |
| `free` | No charge | Internal governance agents |

## Fees

- Platform fee: 5% of gross revenue (CFO-set).
- Payment processing: passthrough (Stripe / Paddle).
- Volume discounts: >100 seats → 10% off; >500 seats → custom.

## Budgets

Budgets are set per capability in `manifest.json`:

```json
"budget": {
  "monthly_cap_usd": 500,
  "alert_at_percent": 80,
  "auto_throttle": true
}
```

When 80% is consumed, the runtime emits an alert event.
When 100% is reached, the capability is auto-throttled until next month or admin override.

## Revenue Share

- Owner receives 95% minus payment processing fees.
- Platform retains 5% (or 3% for org-owned internal capabilities).
- Payouts: monthly, net-30.

## Compliance

- All external listings require CFO sign-off before `published`.
- Pricing changes to published listings require a 7-day notice.
- Metered models must emit `/api/usage` events; missing events default to `flat` pricing for the billing cycle.
