# /services — ForgeOS Services

**Primary owner:** CTO · **Operations co-owner:** COO  
**Purpose:** Backend services, APIs, and shared platform capabilities that apps and agents depend on.

## Structure (per service)
```
services/<service-id>/
  README.md
  manifest.json    # endpoints, deps, SLA, version
  src/
  tests/
```

## Rules
- Services expose stable interfaces (versioned). Breaking changes require an ADR and COO sign-off on rollout.
- Uptime/SLA owned by CTO; release quality gated by COO.
- Services may be listed on the marketplace as consumable capabilities.

## Catalog
- `api-gateway` — route catalog and README.
- `first-app` — sample app scaffold for ForgeOS integration.

## Standalone app manifests
- `apps/first-app/manifest.json` — capability, entrypoint, docs link.
