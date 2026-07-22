# /marketplace — ForgeOS Capability Marketplace

**Primary owner:** CPO · **Economics co-owner:** CFO
**Purpose:** The composable economy of ForgeOS — publish, discover, and consume
apps, services, and agent skills as tradable capabilities.

## Structure
```
marketplace/
  listings/     # published capabilities (manifest + metadata)
  registry/     # discovery index
  economics/    # pricing, fees, incentive model (CFO)
```

## Rules
- Every listing has a manifest: id, type (app|service|skill), owner, version,
  pricing.
- Pricing/economics requires CFO concurrence (ORG repo mapping).
- Listings must reference a real artifact in `/apps`, `/services`, or `/agents`.
- Discovery is open; consumption is governed by the delegation protocol.
