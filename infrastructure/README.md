# /infrastructure — ForgeOS Platform Infrastructure

**Primary owner:** CTO · **Operations co-owner:** COO
**Purpose:** Portable, versioned infrastructure that runs ForgeOS — IaC,
CI/CD, environments, and secrets management.

## Structure
```
infrastructure/
  iac/          # infrastructure-as-code (cloud-agnostic where possible)
  cicd/         # pipelines
  environments/ # dev / staging / prod definitions
  secrets/      # secrets management config (references only, never values)
```

## Rules
- Infrastructure is **portable by design** — avoid single-vendor lock-in.
- Irreversible infra changes (deploys, deletes) require COO/CEO sign-off
  (ORG §3.6).
- Secrets are referenced, never committed. Config only.
- Drift between environments is tracked and reported by COO.
