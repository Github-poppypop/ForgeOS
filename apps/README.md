# /apps — ForgeOS Applications

**Primary owner:** CPO · **Engineering co-owner:** CTO
**Purpose:** User-facing applications built on the ForgeOS platform.

## Structure (per app)
```
apps/<app-id>/
  README.md        # what it is, owner, status
  manifest.json    # capabilities, dependencies, version
  src/             # application source
  tests/
```

## Rules
- Each app declares a `manifest.json` (capabilities, deps, version).
- Apps consume services from `/services` and capabilities from `/marketplace`.
- Feature prioritization is owned by CPO; engineering execution by CTO.
- Apps are publishable units — design for composability.

## Building an app

See **[SDK.md](./SDK.md)** — scaffold pattern, `manifest.json` contract, consuming
`/services`, and wiring an isolated / federated gbrain.
Reference implementation: `apps/brain-console`.
